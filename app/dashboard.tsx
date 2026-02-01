/**
 * Dashboard en tiempo real de asistentes
 *
 * Pantalla de monitoreo que muestra en tiempo real:
 * - Lista de participantes registrados
 * - Asistentes actuales en cada ubicación (Aula Magna, Master Class, Cena)
 * - Contador de asistentes por ubicación
 * - Badges indicando permisos especiales (MC, Cena)
 *
 * Usa suscripciones en tiempo real de Firestore para actualizaciones automáticas
 * cuando un participante entra o sale de una ubicación.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed/themed-view';
import { ThemedText } from '@/components/themed/themed-text';
import {
  subscribeToLocationParticipants,
  subscribeToRegisteredParticipants,
  subscribeToRecentAccessLogs,
  getAccessStats,
  getPermissionBasedCounts,
} from '@/services/participantService';
import { Participant, AccessMode, AccessDirection, AccessLog } from '@/types/participant';
import { Event } from '@/types/event';
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useApp } from '@/contexts/AppContext';
import { LoginButton } from '@/components/forms/LoginButton';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { BackButton } from '@/components/navigation/BackButton';
import { InlineCameraScanner } from '@/components/scanner/InlineCameraScanner';
import { getAllEvents, getEventsByOrganization, getEventsByIds } from '@/services/eventService';

type Location = 'registrados' | 'aula_magna' | 'master_class' | 'cena';

interface LocationInfo {
  key: Location;
  titulo: string;
  icono: string;
  color: string;
}

const LOCATIONS: LocationInfo[] = [
  {
    key: 'registrados',
    titulo: 'Registrados',
    icono: '📝',
    color: Colors.light.modeRegistro,
  },
  {
    key: 'aula_magna',
    titulo: 'Aula Magna',
    icono: '🏛️',
    color: Colors.light.modeAulaMagna,
  },
  {
    key: 'master_class',
    titulo: 'Master Class',
    icono: '🎓',
    color: Colors.light.modeMasterClass,
  },
  {
    key: 'cena',
    titulo: 'Cena',
    icono: '🍽️',
    color: Colors.light.modeCena,
  },
];

export default function DashboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { isWideScreen } = useResponsiveLayout();
  const isWeb = Platform.OS === 'web';

  // Contexto global para modo y dirección de escaneo
  const { setModo, setDireccion } = useApp();

  // Usuario autenticado (necesario para habilitar escaneo)
  const { user, isSuperAdmin } = useAuth();

  // Evento activo (para filtrar participantes)
  const { currentEvent, setCurrentEvent } = useEvent();

  // Estado para el selector de eventos
  const [showEventSelector, setShowEventSelector] = useState(!currentEvent);
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Modo/ubicación seleccionado (unificado para escaneo y estadísticas)
  const [selectedMode, setSelectedMode] = useState<AccessMode>('registro');

  // Lista de participantes en la ubicación seleccionada (actualizada en tiempo real)
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Dirección de escaneo (entrada/salida)
  const [scanDirection, setScanDirection] = useState<AccessDirection>('entrada');

  // Estado para controlar si el selector de modo está expandido (solo móvil)
  const [modeExpanded, setModeExpanded] = useState(false);

  // Estado para mostrar modal de participantes actuales
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [modalSearchText, setModalSearchText] = useState('');
  const [modalFilterMode, setModalFilterMode] = useState<AccessMode | 'todos'>('todos');

  // Lista de TODOS los participantes registrados (para la modal)
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);

  // Estado para el último resultado del scanner inline (web)
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean;
    message: string;
    participant?: Participant;
  } | null>(null);

  // Estadísticas del modo seleccionado
  const [stats, setStats] = useState<{
    uniqueEntrances: number;
    maxSimultaneous: number;
  }>({ uniqueEntrances: 0, maxSimultaneous: 0 });

  // Últimos accesos del modo seleccionado
  const [recentLogs, setRecentLogs] = useState<AccessLog[]>([]);
  const [logsSearchText, setLogsSearchText] = useState('');

  // Filtro de fecha para logs (por defecto: inicio de hoy)
  const getStartOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const getEndOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  };
  const [logsDateFilter, setLogsDateFilter] = useState<'hoy' | '7dias' | '30dias' | 'todo'>('hoy');
  const [logsStartDate, setLogsStartDate] = useState<number>(getStartOfDay(new Date()));
  const [logsEndDate, setLogsEndDate] = useState<number>(getEndOfDay(new Date()));

  // Recuentos totales de participantes por permiso
  const [potentialCounts, setPotentialCounts] = useState({
    registro: 0,
    aula_magna: 0,
    master_class: 0,
    cena: 0,
  });

  /**
   * Cargar eventos disponibles según el rol del usuario
   */
  const loadAvailableEvents = useCallback(async () => {
    if (!user) {
      setAvailableEvents([]);
      setLoadingEvents(false);
      return;
    }

    setLoadingEvents(true);
    try {
      let events: Event[];

      if (isSuperAdmin()) {
        // Super admin ve todos los eventos
        events = await getAllEvents();
      } else if (user.role === 'controlador') {
        // Controlador solo ve eventos asignados
        if (user.assignedEventIds && user.assignedEventIds.length > 0) {
          events = await getEventsByIds(user.assignedEventIds);
        } else {
          events = [];
        }
      } else if (user.organizationId) {
        // Admin responsable y admin ven eventos de su organización
        events = await getEventsByOrganization(user.organizationId);
      } else {
        events = [];
      }

      // Ordenar por fecha (más reciente primero)
      events.sort((a, b) => b.date - a.date);
      setAvailableEvents(events);
    } catch (error) {
      console.error('Error loading events:', error);
      setAvailableEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [user, isSuperAdmin]);

  // Auto-seleccionar si solo hay un evento (separado para evitar bucles)
  useEffect(() => {
    if (!loadingEvents && availableEvents.length === 1 && !currentEvent) {
      setCurrentEvent(availableEvents[0]);
      setShowEventSelector(false);
    }
  }, [loadingEvents, availableEvents, currentEvent, setCurrentEvent]);

  // Cargar eventos cuando cambia el usuario
  useEffect(() => {
    loadAvailableEvents();
  }, [loadAvailableEvents]);

  // Mostrar selector si no hay evento seleccionado
  useEffect(() => {
    if (!currentEvent && !loadingEvents && availableEvents.length > 0) {
      setShowEventSelector(true);
    }
  }, [currentEvent, loadingEvents, availableEvents]);

  /**
   * Seleccionar un evento
   */
  const handleSelectEvent = (event: Event) => {
    setCurrentEvent(event);
    setShowEventSelector(false);
  };

  /**
   * Suscripción en tiempo real a Firestore
   *
   * Se actualiza automáticamente cuando cambia selectedMode o currentEvent
   * Muestra participantes según el modo seleccionado:
   * - registro: todos los registrados
   * - aula_magna/master_class/cena: participantes actualmente en esa ubicación
   */
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const eventId = currentEvent?.id;

    if (selectedMode === 'registro') {
      // Escuchar todos los participantes con estado.registrado = true
      unsubscribe = subscribeToRegisteredParticipants((data) => {
        setParticipants(data);
        setRefreshing(false);
      }, eventId);
    } else {
      // Escuchar participantes en una ubicación específica
      unsubscribe = subscribeToLocationParticipants(selectedMode, (data) => {
        setParticipants(data);
        setRefreshing(false);
      }, eventId);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedMode, currentEvent?.id]);

  /**
   * Suscripción a TODOS los participantes registrados (para la modal)
   * Independiente del modo seleccionado
   */
  useEffect(() => {
    const eventId = currentEvent?.id;

    const unsubscribe = subscribeToRegisteredParticipants((data) => {
      setAllParticipants(data);
    }, eventId);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentEvent?.id]);

  /**
   * Suscripción a los últimos logs y carga de estadísticas
   * Las estadísticas se recargan cada vez que cambian los logs
   */
  useEffect(() => {
    const eventId = currentEvent?.id;

    // Función para cargar estadísticas
    const loadStats = () => {
      getAccessStats(selectedMode, eventId).then((newStats) => {
        setStats(newStats);
      });
    };

    // Cargar estadísticas iniciales
    loadStats();

    // Suscribirse a logs con filtro de fecha
    // Cuando el filtro es 'todo', no se pasa límite ni fechas
    const startDate = logsDateFilter === 'todo' ? undefined : logsStartDate;
    const endDate = logsDateFilter === 'todo' ? undefined : logsEndDate;
    const logLimit = logsDateFilter === 'todo' ? 100 : 0; // 0 = sin límite cuando hay filtro de fecha

    const unsubscribeLogs = subscribeToRecentAccessLogs(
      selectedMode,
      logLimit,
      (logs) => {
        setRecentLogs(logs);
        // Recargar estadísticas cuando llegan nuevos logs
        loadStats();
      },
      eventId,
      startDate,
      endDate
    );

    return () => {
      unsubscribeLogs();
    };
  }, [selectedMode, currentEvent?.id, logsDateFilter, logsStartDate, logsEndDate]);

  /**
   * Cargar recuentos totales de permisos al montar y cuando cambie el evento
   */
  useEffect(() => {
    getPermissionBasedCounts(currentEvent?.id).then(setPotentialCounts);
  }, [currentEvent?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    // La suscripción en tiempo real se encargará de actualizar
  };

  /**
   * Cambiar el filtro de fecha para los logs
   */
  const handleDateFilterChange = (filter: 'hoy' | '7dias' | '30dias' | 'todo') => {
    setLogsDateFilter(filter);
    const now = new Date();

    switch (filter) {
      case 'hoy':
        setLogsStartDate(getStartOfDay(now));
        setLogsEndDate(getEndOfDay(now));
        break;
      case '7dias':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        setLogsStartDate(getStartOfDay(weekAgo));
        setLogsEndDate(getEndOfDay(now));
        break;
      case '30dias':
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        setLogsStartDate(getStartOfDay(monthAgo));
        setLogsEndDate(getEndOfDay(now));
        break;
      case 'todo':
        // No se aplica filtro de fecha
        break;
    }
  };

  /**
   * Abre la cámara para escanear QR
   * Guarda el modo y dirección en el contexto global antes de navegar
   * Solo funciona si el usuario está autenticado
   */
  const handleOpenScanner = () => {
    if (!user) {
      // Usuario no autenticado, mostrar alerta
      if (Platform.OS === 'web') {
        window.alert('Debes iniciar sesión para escanear códigos QR');
      } else {
        alert('Debes iniciar sesión para escanear códigos QR');
      }
      return;
    }

    setModo(selectedMode);
    setDireccion(scanDirection);
    router.push('/scanner');
  };

  /**
   * Maneja el resultado del escáner inline (web)
   */
  const handleInlineScanResult = (success: boolean, message: string, participant?: Participant) => {
    setLastScanResult({ success, message, participant });
    // Auto-clear después de 4 segundos
    setTimeout(() => setLastScanResult(null), 4000);
  };

  const renderParticipant = ({ item }: { item: Participant }) => (
    <View
      style={[
        styles.participantCard,
        colorScheme === 'dark' ? Shadows.light : Shadows.light,
        {
          backgroundColor:
            colorScheme === 'dark'
              ? Colors.dark.cardBackground
              : Colors.light.cardBackground,
        },
      ]}
    >
      <View style={styles.participantInfo}>
        <ThemedText style={styles.participantName}>{item.nombre}</ThemedText>
        <ThemedText style={styles.participantDni}>DNI: {item.dni}</ThemedText>
      </View>

      <View style={styles.participantBadges}>
        {item.permisos.master_class && (
          <View style={[styles.badge, { backgroundColor: Colors.light.modeMasterClass }]}>
            <Text style={styles.badgeText}>MC</Text>
          </View>
        )}
        {item.permisos.cena && (
          <View style={[styles.badge, { backgroundColor: Colors.light.modeCena }]}>
            <Text style={styles.badgeText}>Cena</Text>
          </View>
        )}
      </View>
    </View>
  );

  // Configuración unificada de modos (para escaneo y estadísticas)
  const MODES = [
    { key: 'registro' as AccessMode, titulo: 'Registro', icono: '📝', color: Colors.light.modeRegistro },
    { key: 'aula_magna' as AccessMode, titulo: 'Aula Magna', icono: '🏛️', color: Colors.light.modeAulaMagna },
    { key: 'master_class' as AccessMode, titulo: 'Master Class', icono: '🎓', color: Colors.light.modeMasterClass },
    { key: 'cena' as AccessMode, titulo: 'Cena', icono: '🍽️', color: Colors.light.modeCena },
  ];

  const selectedModeInfo = MODES.find((m) => m.key === selectedMode);

  /**
   * Maneja la selección de un modo y contrae el selector
   */
  const handleModeSelection = (mode: AccessMode) => {
    setSelectedMode(mode);
    setModeExpanded(false);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Modal selector de eventos */}
      <Modal
        visible={showEventSelector}
        animationType="slide"
        transparent={false}
        onRequestClose={() => currentEvent && setShowEventSelector(false)}
      >
        <ThemedView style={styles.eventSelectorModal}>
          <View style={styles.eventSelectorHeader}>
            <Image
              source={{ uri: 'https://impulseducacio.org/wp-content/uploads/2020/02/logo-web-impuls.png' }}
              style={styles.eventSelectorLogo}
              resizeMode="contain"
            />
            <ThemedText style={styles.eventSelectorTitle}>
              Selecciona un Evento
            </ThemedText>
            <ThemedText style={styles.eventSelectorSubtitle}>
              ¿Para qué evento quieres hacer control de acceso?
            </ThemedText>
          </View>

          {loadingEvents ? (
            <View style={styles.eventSelectorLoading}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
              <ThemedText style={{ marginTop: Spacing.md }}>Cargando eventos...</ThemedText>
            </View>
          ) : availableEvents.length === 0 ? (
            <View style={styles.eventSelectorEmpty}>
              <Text style={styles.eventSelectorEmptyIcon}>📭</Text>
              <ThemedText style={styles.eventSelectorEmptyText}>
                {!user
                  ? 'Inicia sesión para ver los eventos disponibles'
                  : user.role === 'controlador'
                  ? 'No tienes eventos asignados. Contacta con tu administrador.'
                  : !user.organizationId
                  ? 'Tu cuenta no tiene organización asignada. Contacta con tu administrador.'
                  : 'No hay eventos disponibles en tu organización.'}
              </ThemedText>
              {!user && (
                <View style={{ marginTop: Spacing.lg }}>
                  <LoginButton />
                </View>
              )}
            </View>
          ) : (
            <ScrollView style={styles.eventSelectorList}>
              {availableEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={[
                    styles.eventSelectorCard,
                    Shadows.medium,
                    {
                      backgroundColor: colorScheme === 'dark'
                        ? Colors.dark.cardBackground
                        : Colors.light.cardBackground,
                      borderColor: event.status === 'active'
                        ? Colors.light.success
                        : Colors.light.border,
                      borderWidth: event.status === 'active' ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleSelectEvent(event)}
                  activeOpacity={0.7}
                >
                  <View style={styles.eventSelectorCardContent}>
                    <View style={styles.eventSelectorCardHeader}>
                      <Text style={[styles.eventSelectorCardName, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                        {event.name}
                      </Text>
                      {event.status === 'active' && (
                        <View style={[styles.eventStatusBadge, { backgroundColor: Colors.light.success }]}>
                          <Text style={styles.eventStatusBadgeText}>Activo</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.eventSelectorCardDate, { color: colorScheme === 'dark' ? '#ccc' : '#666' }]}>
                      📅 {new Date(event.date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                    {event.location && (
                      <Text style={[styles.eventSelectorCardLocation, { color: colorScheme === 'dark' ? '#ccc' : '#666' }]}>
                        📍 {event.location}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.eventSelectorCardArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Botón para volver si ya hay evento seleccionado */}
          {currentEvent && (
            <View style={styles.eventSelectorFooter}>
              <TouchableOpacity
                style={[styles.eventSelectorCancelButton, { backgroundColor: Colors.light.border }]}
                onPress={() => setShowEventSelector(false)}
              >
                <Text style={styles.eventSelectorCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botón volver a inicio */}
          <View style={styles.eventSelectorBackRow}>
            <TouchableOpacity
              style={styles.eventSelectorBackButton}
              onPress={() => {
                setShowEventSelector(false);
                router.replace('/');
              }}
            >
              <Text style={[styles.eventSelectorBackText, { color: Colors.light.primary }]}>
                ← Volver al inicio
              </Text>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </Modal>

      {/* Header común para web y móvil */}
      <View style={styles.headerContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={{ uri: 'https://impulseducacio.org/wp-content/uploads/2020/02/logo-web-impuls.png' }}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.loginContainer}>
          <LoginButton />
        </View>
      </View>

      {/* Current event indicator - clickable to change */}
      {currentEvent ? (
        <TouchableOpacity
          style={[styles.eventBanner, { backgroundColor: Colors.light.success + '20' }]}
          onPress={() => setShowEventSelector(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.eventBannerIcon]}>📅</Text>
          <View style={styles.eventBannerText}>
            <Text style={[styles.eventBannerLabel, { color: Colors.light.success }]}>
              Evento activo (toca para cambiar)
            </Text>
            <Text style={[styles.eventBannerName, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
              {currentEvent.name}
            </Text>
          </View>
          <Text style={styles.eventBannerChangeIcon}>✏️</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.eventBanner, { backgroundColor: Colors.light.warning + '20' }]}
          onPress={() => setShowEventSelector(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.eventBannerIcon]}>⚠️</Text>
          <Text style={[styles.eventBannerLabel, { color: Colors.light.warning }]}>
            Toca para seleccionar un evento
          </Text>
        </TouchableOpacity>
      )}

      {/* Layout de dos columnas para web, una columna para móvil */}
      {isWeb && isWideScreen ? (
        // WEB: Layout de dos columnas fijas (sin scroll de página)
        <View style={styles.webTwoColumnContainer}>
            {/* Columna izquierda - 2/5 */}
            <View style={styles.webLeftColumn}>
              {/* Selector de Modo - siempre expandido en web */}
              <View style={styles.modeSection}>
                <ThemedText style={styles.sectionTitle}>Selecciona el Modo</ThemedText>
                <View style={styles.modeSelectorWeb}>
                  {MODES.map((mode) => (
                    <TouchableOpacity
                      key={mode.key}
                      style={[
                        styles.modeButtonWeb,
                        {
                          backgroundColor:
                            selectedMode === mode.key
                              ? mode.color
                              : colorScheme === 'dark'
                              ? 'rgba(255,255,255,0.1)'
                              : 'rgba(0,0,0,0.1)',
                        },
                      ]}
                      onPress={() => setSelectedMode(mode.key)}
                    >
                      <Text style={styles.modeIcon}>{mode.icono}</Text>
                      <Text
                        style={[
                          styles.modeText,
                          {
                            color:
                              selectedMode === mode.key
                                ? '#fff'
                                : colorScheme === 'dark'
                                ? '#fff'
                                : '#000',
                          },
                        ]}
                      >
                        {mode.titulo}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Selector de dirección - siempre visible en web, deshabilitado en registro */}
              <View style={styles.scanControls}>
                <View style={styles.directionSelector}>
                  <TouchableOpacity
                    style={[
                      styles.directionButton,
                      scanDirection === 'entrada' && selectedMode !== 'registro' && styles.directionButtonActive,
                      scanDirection === 'entrada' && selectedMode !== 'registro' && { backgroundColor: Colors.light.directionEntrada },
                      selectedMode === 'registro' && styles.directionButtonDisabled,
                    ]}
                    onPress={() => selectedMode !== 'registro' && setScanDirection('entrada')}
                    disabled={selectedMode === 'registro'}
                  >
                    <Text style={[
                      styles.directionButtonText,
                      scanDirection === 'entrada' && selectedMode !== 'registro' && styles.directionButtonTextActive,
                      selectedMode === 'registro' && styles.directionButtonTextDisabled,
                    ]}>
                      ⬇️ Entrada
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.directionButton,
                      scanDirection === 'salida' && selectedMode !== 'registro' && styles.directionButtonActive,
                      scanDirection === 'salida' && selectedMode !== 'registro' && { backgroundColor: Colors.light.directionSalida },
                      selectedMode === 'registro' && styles.directionButtonDisabled,
                    ]}
                    onPress={() => selectedMode !== 'registro' && setScanDirection('salida')}
                    disabled={selectedMode === 'registro'}
                  >
                    <Text style={[
                      styles.directionButtonText,
                      scanDirection === 'salida' && selectedMode !== 'registro' && styles.directionButtonTextActive,
                      selectedMode === 'registro' && styles.directionButtonTextDisabled,
                    ]}>
                      ⬆️ Salida
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Botón para abrir escáner en nueva ventana */}
                <TouchableOpacity
                  style={[
                    styles.scanButton,
                    Shadows.strong,
                    {
                      backgroundColor: selectedModeInfo?.color,
                      opacity: user ? 1 : 0.5,
                    },
                  ]}
                  onPress={handleOpenScanner}
                  activeOpacity={0.8}
                >
                  <Text style={styles.scanButtonIcon}>📷</Text>
                  <Text style={styles.scanButtonText}>
                    {user ? 'Abrir Escáner' : 'Escáner (requiere login)'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Cámara inline para web */}
              {user && (
                <View style={styles.inlineCameraContainer}>
                  <ThemedText style={styles.subsectionTitle}>Cámara</ThemedText>
                  <InlineCameraScanner onScanResult={handleInlineScanResult} />
                </View>
              )}
            </View>

            {/* Columna derecha - 3/5 */}
            <View style={styles.webRightColumn}>
              {/* Estadísticas del modo seleccionado */}
              <View style={styles.statsSection}>
                <ThemedText style={styles.sectionTitle}>
                  {selectedModeInfo?.icono} {selectedModeInfo?.titulo}
                </ThemedText>

                {/* Indicadores - Clickeable para ver lista de participantes */}
                <TouchableOpacity
                  style={styles.indicatorsRow}
                  onPress={() => {
                    setModalFilterMode(selectedMode);
                    setShowParticipantsModal(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.indicatorCard, { backgroundColor: selectedModeInfo?.color }]}>
                    <Text style={styles.indicatorNumber}>{participants.length}</Text>
                    <Text style={styles.indicatorLabel}>
                      {selectedMode === 'registro' ? 'Registrados' : 'Ahora mismo'}
                    </Text>
                  </View>

                  <View style={[styles.indicatorCard, { backgroundColor: selectedModeInfo?.color }]}>
                    <Text style={styles.indicatorNumber}>
                      {selectedMode === 'registro'
                        ? `${potentialCounts[selectedMode] > 0 ? Math.round((participants.length / potentialCounts[selectedMode]) * 100) : 0}%`
                        : stats.maxSimultaneous}
                    </Text>
                    <Text style={styles.indicatorLabel}>
                      {selectedMode === 'registro' ? '% Asistencia' : 'Máximo'}
                    </Text>
                  </View>

                  {selectedMode !== 'registro' && (
                    <View style={[styles.indicatorCard, { backgroundColor: selectedModeInfo?.color }]}>
                      <Text style={styles.indicatorNumber}>{stats.uniqueEntrances}</Text>
                      <Text style={styles.indicatorLabel}>Han entrado</Text>
                    </View>
                  )}

                  <View style={[styles.indicatorCard, { backgroundColor: selectedModeInfo?.color, opacity: 0.8 }]}>
                    <Text style={styles.indicatorNumber}>{potentialCounts[selectedMode]}</Text>
                    <Text style={styles.indicatorLabel}>Previstos</Text>
                  </View>
                </TouchableOpacity>
                <Text style={[styles.indicatorsHint, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }]}>
                  Toca para ver lista de participantes
                </Text>
              </View>

              {/* Tabla de logs con scroll */}
              <View style={styles.webLogsSection}>
                <Text style={[styles.webSubsectionTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                  {selectedMode === 'registro' ? 'Últimos registros' : 'Últimos accesos'}
                </Text>

                {/* Filtro de fecha */}
                <View style={styles.dateFilterContainer}>
                  {(['hoy', '7dias', '30dias', 'todo'] as const).map((filter) => (
                    <TouchableOpacity
                      key={filter}
                      style={[
                        styles.dateFilterButton,
                        {
                          backgroundColor: logsDateFilter === filter
                            ? Colors.light.primary
                            : (colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f0f0f0'),
                        },
                      ]}
                      onPress={() => handleDateFilterChange(filter)}
                    >
                      <Text
                        style={[
                          styles.dateFilterText,
                          {
                            color: logsDateFilter === filter
                              ? '#fff'
                              : (colorScheme === 'dark' ? '#ccc' : '#666'),
                          },
                        ]}
                      >
                        {filter === 'hoy' ? 'Hoy' : filter === '7dias' ? '7 días' : filter === '30dias' ? '30 días' : 'Todo'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Buscador de logs */}
                <View style={[styles.logsSearchContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#fff', borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.2)' : '#ddd' }]}>
                  <Text style={styles.logsSearchIcon}>🔍</Text>
                  <TextInput
                    style={[styles.logsSearchInput, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
                    placeholder="Buscar por nombre, DNI, correo..."
                    placeholderTextColor={colorScheme === 'dark' ? '#888' : '#999'}
                    value={logsSearchText}
                    onChangeText={setLogsSearchText}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {logsSearchText.length > 0 && (
                    <TouchableOpacity onPress={() => setLogsSearchText('')}>
                      <Text style={styles.logsSearchClear}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {recentLogs.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <ThemedText style={styles.emptyText}>
                      {logsDateFilter === 'hoy'
                        ? 'No hay registros de hoy'
                        : logsDateFilter === '7dias'
                        ? 'No hay registros en los últimos 7 días'
                        : logsDateFilter === '30dias'
                        ? 'No hay registros en los últimos 30 días'
                        : 'Aún no hay registros'}
                    </ThemedText>
                  </View>
                ) : (
                  <ScrollView style={[styles.webLogsScrollContainer, { borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]}>
                    {/* Encabezado de tabla */}
                    <View style={[styles.webTableHeader, { backgroundColor: colorScheme === 'dark' ? Colors.dark.cardBackground : '#f0f0f0' }]}>
                      <Text style={[styles.webTableHeaderCell, styles.webTableCellNombre, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>Nombre</Text>
                      <Text style={[styles.webTableHeaderCell, styles.webTableCellDni, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>DNI</Text>
                      <Text style={[styles.webTableHeaderCell, styles.webTableCellEmail, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>Correo</Text>
                      <Text style={[styles.webTableHeaderCell, styles.webTableCellEntidad, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>Entidad</Text>
                      <Text style={[styles.webTableHeaderCell, styles.webTableCellCargo, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>Cargo</Text>
                      <Text style={[styles.webTableHeaderCell, styles.webTableCellDir, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>Dir.</Text>
                      <Text style={[styles.webTableHeaderCell, styles.webTableCellHora, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>Hora</Text>
                    </View>

                    {/* Filas de tabla */}
                    {recentLogs
                      .filter(log => {
                        if (!logsSearchText.trim()) return true;
                        const searchLower = logsSearchText.toLowerCase().trim();
                        const searchFields = [
                          log.nombre, log.dni, log.email, log.escuela, log.cargo, log.mensaje
                        ].filter(Boolean).join(' ').toLowerCase();
                        return searchFields.includes(searchLower);
                      })
                      .map((log, index) => (
                      <View
                        key={`${log.dni}-${log.timestamp}-${index}`}
                        style={[
                          styles.webTableRow,
                          {
                            backgroundColor: index % 2 === 0
                              ? (colorScheme === 'dark' ? Colors.dark.cardBackground : '#fff')
                              : (colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'),
                            borderBottomColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                          },
                        ]}
                      >
                        <Text style={[styles.webTableCell, styles.webTableCellNombre, { color: colorScheme === 'dark' ? '#fff' : '#000' }]} numberOfLines={1}>
                          {log.nombre}
                        </Text>
                        <Text style={[styles.webTableCell, styles.webTableCellDni, { color: colorScheme === 'dark' ? '#fff' : '#000' }]} numberOfLines={1}>
                          {log.dni}
                        </Text>
                        <Text style={[styles.webTableCell, styles.webTableCellEmail, { color: colorScheme === 'dark' ? '#ddd' : '#000' }]} numberOfLines={1}>
                          {log.email || '-'}
                        </Text>
                        <Text style={[styles.webTableCell, styles.webTableCellEntidad, { color: colorScheme === 'dark' ? '#ddd' : '#000' }]} numberOfLines={1}>
                          {log.escuela || '-'}
                        </Text>
                        <Text style={[styles.webTableCell, styles.webTableCellCargo, { color: colorScheme === 'dark' ? '#ddd' : '#000' }]} numberOfLines={1}>
                          {log.cargo || '-'}
                        </Text>
                        <View style={[styles.webTableCellDir]}>
                          {log.modo === 'registro' ? (
                            <View style={{
                              backgroundColor: Colors.light.modeRegistro,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 4,
                            }}>
                              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
                                Registrado
                              </Text>
                            </View>
                          ) : log.direccion && (
                            <View style={{
                              backgroundColor: log.direccion === 'entrada'
                                ? Colors.light.directionEntrada
                                : Colors.light.directionSalida,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 4,
                            }}>
                              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
                                {log.direccion === 'entrada' ? 'Entrada' : 'Salida'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.webTableCell, styles.webTableCellHora, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                          {new Date(log.timestamp).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          </View>
        ) : (
          // MÓVIL: Layout original de una columna con scroll
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Selector de Modo */}
            <View style={styles.modeSection}>
              <ThemedText style={styles.sectionTitle}>Selecciona el Modo</ThemedText>

              <View style={styles.modeRowContainer}>
                <TouchableOpacity
                  style={[
                    styles.hamburgerButton,
                    {
                      backgroundColor:
                        colorScheme === 'dark'
                          ? 'rgba(255,255,255,0.15)'
                          : 'rgba(0,0,0,0.1)',
                    },
                    Shadows.medium,
                  ]}
                  onPress={() => setModeExpanded(!modeExpanded)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.hamburgerIcon}>{modeExpanded ? '✕' : '☰'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeSelectorCollapsed,
                    { backgroundColor: selectedModeInfo?.color },
                    Shadows.medium,
                  ]}
                  onPress={() => setModeExpanded(!modeExpanded)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modeIconLarge}>{selectedModeInfo?.icono}</Text>
                  <Text style={styles.modeTextLarge}>{selectedModeInfo?.titulo}</Text>
                </TouchableOpacity>
              </View>

              {modeExpanded && (
                <View style={styles.modeSelector}>
                  {MODES.map((mode) => (
                    <TouchableOpacity
                      key={mode.key}
                      style={[
                        styles.modeButton,
                        {
                          backgroundColor:
                            selectedMode === mode.key
                              ? mode.color
                              : colorScheme === 'dark'
                              ? 'rgba(255,255,255,0.1)'
                              : 'rgba(0,0,0,0.1)',
                        },
                      ]}
                      onPress={() => handleModeSelection(mode.key)}
                    >
                      <Text style={styles.modeIcon}>{mode.icono}</Text>
                      <Text
                        style={[
                          styles.modeText,
                          {
                            color:
                              selectedMode === mode.key
                                ? '#fff'
                                : colorScheme === 'dark'
                                ? '#fff'
                                : '#000',
                          },
                        ]}
                      >
                        {mode.titulo}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Controles de Escaneo */}
            <View style={styles.scanControls}>
              {selectedMode !== 'registro' && (
                <View style={styles.directionSelector}>
                  <TouchableOpacity
                    style={[
                      styles.directionButton,
                      scanDirection === 'entrada' && styles.directionButtonActive,
                      scanDirection === 'entrada' && { backgroundColor: Colors.light.directionEntrada },
                    ]}
                    onPress={() => setScanDirection('entrada')}
                  >
                    <Text style={[
                      styles.directionButtonText,
                      scanDirection === 'entrada' && styles.directionButtonTextActive
                    ]}>
                      ⬇️ Entrada
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.directionButton,
                      scanDirection === 'salida' && styles.directionButtonActive,
                      scanDirection === 'salida' && { backgroundColor: Colors.light.directionSalida },
                    ]}
                    onPress={() => setScanDirection('salida')}
                  >
                    <Text style={[
                      styles.directionButtonText,
                      scanDirection === 'salida' && styles.directionButtonTextActive
                    ]}>
                      ⬆️ Salida
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.scanButton,
                  Shadows.strong,
                  {
                    backgroundColor: selectedModeInfo?.color,
                    opacity: user ? 1 : 0.5,
                  },
                ]}
                onPress={handleOpenScanner}
                activeOpacity={0.8}
              >
                <Text style={styles.scanButtonIcon}>📷</Text>
                <Text style={styles.scanButtonText}>
                  {user ? 'Escanear QR' : 'Escanear QR (requiere login)'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Estadísticas del modo seleccionado */}
            <View style={styles.statsSection}>
              <ThemedText style={styles.sectionTitle}>
                {selectedModeInfo?.icono} {selectedModeInfo?.titulo}
              </ThemedText>

              {/* Indicadores - Clickeable para ver lista de participantes */}
              <TouchableOpacity
                style={styles.indicatorsRow}
                onPress={() => {
                  setModalFilterMode(selectedMode);
                  setShowParticipantsModal(true);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.indicatorCard, { backgroundColor: selectedModeInfo?.color }]}>
                  <Text style={styles.indicatorNumber}>{participants.length}</Text>
                  <Text style={styles.indicatorLabel}>
                    {selectedMode === 'registro' ? 'Registrados' : 'Ahora mismo'}
                  </Text>
                </View>

                <View style={[styles.indicatorCard, { backgroundColor: selectedModeInfo?.color }]}>
                  <Text style={styles.indicatorNumber}>
                    {selectedMode === 'registro'
                      ? `${potentialCounts[selectedMode] > 0 ? Math.round((participants.length / potentialCounts[selectedMode]) * 100) : 0}%`
                      : stats.maxSimultaneous}
                  </Text>
                  <Text style={styles.indicatorLabel}>
                    {selectedMode === 'registro' ? '% Asistencia' : 'Máximo'}
                  </Text>
                </View>

                {selectedMode !== 'registro' && (
                  <View style={[styles.indicatorCard, { backgroundColor: selectedModeInfo?.color }]}>
                    <Text style={styles.indicatorNumber}>{stats.uniqueEntrances}</Text>
                    <Text style={styles.indicatorLabel}>Han entrado</Text>
                  </View>
                )}

                <View style={[styles.indicatorCard, { backgroundColor: selectedModeInfo?.color, opacity: 0.8 }]}>
                  <Text style={styles.indicatorNumber}>{potentialCounts[selectedMode]}</Text>
                  <Text style={styles.indicatorLabel}>Previstos</Text>
                </View>
              </TouchableOpacity>
              <Text style={[styles.indicatorsHint, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }]}>
                Toca para ver lista de participantes
              </Text>

              <View style={styles.recentAccessSection}>
                <ThemedText style={styles.subsectionTitle}>
                  {selectedMode === 'registro' ? 'Últimos registros' : 'Últimos accesos'}
                </ThemedText>

                {/* Filtro de fecha */}
                <View style={styles.dateFilterContainer}>
                  {(['hoy', '7dias', '30dias', 'todo'] as const).map((filter) => (
                    <TouchableOpacity
                      key={filter}
                      style={[
                        styles.dateFilterButton,
                        {
                          backgroundColor: logsDateFilter === filter
                            ? Colors.light.primary
                            : (colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f0f0f0'),
                        },
                      ]}
                      onPress={() => handleDateFilterChange(filter)}
                    >
                      <Text
                        style={[
                          styles.dateFilterText,
                          {
                            color: logsDateFilter === filter
                              ? '#fff'
                              : (colorScheme === 'dark' ? '#ccc' : '#666'),
                          },
                        ]}
                      >
                        {filter === 'hoy' ? 'Hoy' : filter === '7dias' ? '7 días' : filter === '30dias' ? '30 días' : 'Todo'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Buscador de logs */}
                <View style={[styles.logsSearchContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#fff', borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.2)' : '#ddd' }]}>
                  <Text style={styles.logsSearchIcon}>🔍</Text>
                  <TextInput
                    style={[styles.logsSearchInput, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
                    placeholder="Buscar por nombre, DNI, correo..."
                    placeholderTextColor={colorScheme === 'dark' ? '#888' : '#999'}
                    value={logsSearchText}
                    onChangeText={setLogsSearchText}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {logsSearchText.length > 0 && (
                    <TouchableOpacity onPress={() => setLogsSearchText('')}>
                      <Text style={styles.logsSearchClear}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {recentLogs.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <ThemedText style={styles.emptyText}>
                      {logsDateFilter === 'hoy'
                        ? 'No hay registros de hoy'
                        : logsDateFilter === '7dias'
                        ? 'No hay registros en los últimos 7 días'
                        : logsDateFilter === '30dias'
                        ? 'No hay registros en los últimos 30 días'
                        : 'Aún no hay registros'}
                    </ThemedText>
                  </View>
                ) : (
                  <View style={styles.logsContainer}>
                    {recentLogs
                      .filter(log => {
                        if (!logsSearchText.trim()) return true;
                        const searchLower = logsSearchText.toLowerCase().trim();
                        const searchFields = [
                          log.nombre, log.dni, log.email, log.escuela, log.cargo, log.mensaje
                        ].filter(Boolean).join(' ').toLowerCase();
                        return searchFields.includes(searchLower);
                      })
                      .map((log, index) => (
                      <View
                        key={`${log.dni}-${log.timestamp}-${index}`}
                        style={[
                          styles.logCard,
                          colorScheme === 'dark' ? Shadows.light : Shadows.light,
                          {
                            backgroundColor:
                              colorScheme === 'dark'
                                ? Colors.dark.cardBackground
                                : Colors.light.cardBackground,
                          },
                        ]}
                      >
                        <View style={styles.logInfo}>
                          <ThemedText style={styles.logName}>{log.nombre}</ThemedText>
                          <ThemedText style={styles.logDni}>DNI: {log.dni}</ThemedText>
                          {log.email && (
                            <ThemedText style={styles.logDetail}>📧 {log.email}</ThemedText>
                          )}
                          {log.telefono && (
                            <ThemedText style={styles.logDetail}>📞 {log.telefono}</ThemedText>
                          )}
                          {log.escuela && (
                            <ThemedText style={styles.logDetail}>🏫 {log.escuela}</ThemedText>
                          )}
                          {log.cargo && (
                            <ThemedText style={styles.logDetail}>💼 {log.cargo}</ThemedText>
                          )}
                          {log.permisos && (
                            <View style={styles.logPermisosRow}>
                              {log.permisos.master_class && (
                                <View style={[styles.logPermisoBadge, { backgroundColor: Colors.light.modeMasterClass }]}>
                                  <Text style={styles.logPermisoText}>MC</Text>
                                </View>
                              )}
                              {log.permisos.cena && (
                                <View style={[styles.logPermisoBadge, { backgroundColor: Colors.light.modeCena }]}>
                                  <Text style={styles.logPermisoText}>Cena</Text>
                                </View>
                              )}
                              {log.haPagado && (
                                <View style={[styles.logPermisoBadge, { backgroundColor: Colors.light.success }]}>
                                  <Text style={styles.logPermisoText}>✓ Pagado</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                        <View style={styles.logMeta}>
                          {log.modo === 'registro' ? (
                            <View style={{
                              backgroundColor: Colors.light.modeRegistro,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 4,
                            }}>
                              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
                                Registrado
                              </Text>
                            </View>
                          ) : log.direccion && (
                            <View style={{
                              backgroundColor: log.direccion === 'entrada'
                                ? Colors.light.directionEntrada
                                : Colors.light.directionSalida,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 4,
                            }}>
                              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
                                {log.direccion === 'entrada' ? 'Entrada' : 'Salida'}
                              </Text>
                            </View>
                          )}
                          <ThemedText style={styles.logTime}>
                            {new Date(log.timestamp).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        )}
    <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <BackButton style={{ margin: 0 }} />
    </View>

    {/* Modal de participantes actuales */}
    <Modal
      visible={showParticipantsModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowParticipantsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.participantsModalContent,
          {
            backgroundColor: colorScheme === 'dark' ? Colors.dark.cardBackground : '#fff',
            maxWidth: isWeb && isWideScreen ? 900 : '95%',
          }
        ]}>
          {/* Header del modal */}
          <View style={[styles.participantsModalHeader, { backgroundColor: Colors.light.primary }]}>
            <Text style={styles.participantsModalTitle}>
              📋 Lista de Participantes
            </Text>
            <TouchableOpacity
              style={styles.participantsModalClose}
              onPress={() => {
                setShowParticipantsModal(false);
                setModalSearchText('');
                setModalFilterMode('todos');
              }}
            >
              <Text style={styles.participantsModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Controles de búsqueda y filtro */}
          <View style={[styles.modalFiltersContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.3)' : '#f9f9f9' }]}>
            {/* Buscador */}
            <View style={[styles.modalSearchContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#fff', borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.2)' : '#ddd' }]}>
              <Text style={styles.modalSearchIcon}>🔍</Text>
              <TextInput
                style={[styles.modalSearchInput, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
                placeholder="Buscar por nombre, DNI, correo, entidad..."
                placeholderTextColor={colorScheme === 'dark' ? '#888' : '#999'}
                value={modalSearchText}
                onChangeText={setModalSearchText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {modalSearchText.length > 0 && (
                <TouchableOpacity onPress={() => setModalSearchText('')}>
                  <Text style={styles.modalSearchClear}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Selector de modo */}
            <View style={styles.modalModeSelector}>
              <TouchableOpacity
                style={[
                  styles.modalModeButton,
                  modalFilterMode === 'todos' && styles.modalModeButtonActive,
                  modalFilterMode === 'todos' && { backgroundColor: Colors.light.primary }
                ]}
                onPress={() => setModalFilterMode('todos')}
              >
                <Text style={[styles.modalModeButtonText, modalFilterMode === 'todos' && styles.modalModeButtonTextActive]}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalModeButton,
                  modalFilterMode === 'registro' && styles.modalModeButtonActive,
                  modalFilterMode === 'registro' && { backgroundColor: Colors.light.modeRegistro }
                ]}
                onPress={() => setModalFilterMode('registro')}
              >
                <Text style={[styles.modalModeButtonText, modalFilterMode === 'registro' && styles.modalModeButtonTextActive]}>Registrados</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalModeButton,
                  modalFilterMode === 'aula_magna' && styles.modalModeButtonActive,
                  modalFilterMode === 'aula_magna' && { backgroundColor: Colors.light.modeAulaMagna }
                ]}
                onPress={() => setModalFilterMode('aula_magna')}
              >
                <Text style={[styles.modalModeButtonText, modalFilterMode === 'aula_magna' && styles.modalModeButtonTextActive]}>Aula Magna</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalModeButton,
                  modalFilterMode === 'master_class' && styles.modalModeButtonActive,
                  modalFilterMode === 'master_class' && { backgroundColor: Colors.light.modeMasterClass }
                ]}
                onPress={() => setModalFilterMode('master_class')}
              >
                <Text style={[styles.modalModeButtonText, modalFilterMode === 'master_class' && styles.modalModeButtonTextActive]}>Master Class</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalModeButton,
                  modalFilterMode === 'cena' && styles.modalModeButtonActive,
                  modalFilterMode === 'cena' && { backgroundColor: Colors.light.modeCena }
                ]}
                onPress={() => setModalFilterMode('cena')}
              >
                <Text style={[styles.modalModeButtonText, modalFilterMode === 'cena' && styles.modalModeButtonTextActive]}>Cena</Text>
              </TouchableOpacity>
            </View>

            {/* Contador de resultados */}
            <Text style={[styles.modalResultsCount, { color: colorScheme === 'dark' ? '#aaa' : '#666' }]}>
              {(() => {
                const searchLower = modalSearchText.toLowerCase().trim();
                const filtered = allParticipants.filter(p => {
                  // Filtro de modo
                  if (modalFilterMode !== 'todos') {
                    if (modalFilterMode === 'registro' && !p.estado?.registrado) return false;
                    if (modalFilterMode === 'aula_magna' && !p.estado?.en_aula_magna) return false;
                    if (modalFilterMode === 'master_class' && !p.estado?.en_master_class) return false;
                    if (modalFilterMode === 'cena' && !p.estado?.en_cena) return false;
                  }
                  // Filtro de búsqueda
                  if (searchLower) {
                    const searchFields = [
                      p.nombre, p.dni, p.email, p.entitat, p.escuela, p.cargo, p.telefono, p.acceso
                    ].filter(Boolean).join(' ').toLowerCase();
                    if (!searchFields.includes(searchLower)) return false;
                  }
                  return true;
                });
                return `${filtered.length} de ${allParticipants.length} participantes`;
              })()}
            </Text>
          </View>

          {/* Contenido del modal */}
          {allParticipants.length === 0 ? (
            <View style={styles.participantsModalEmpty}>
              <Text style={styles.participantsModalEmptyIcon}>📋</Text>
              <Text style={[styles.participantsModalEmptyText, { color: colorScheme === 'dark' ? '#ccc' : '#666' }]}>
                No hay participantes registrados
              </Text>
            </View>
          ) : (
            <View style={styles.participantsTableScrollWrapper}>
              <View style={styles.participantsTableContainer}>
                {/* Tabla header */}
                <View style={[styles.participantsTableHeader, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f5f5f5' }]}>
                  <Text style={[styles.participantsTableHeaderCell, styles.participantsTableCellNombre, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>Nombre</Text>
                  <Text style={[styles.participantsTableHeaderCell, styles.participantsTableCellUbicacion, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>Ubicación</Text>
                  <Text style={[styles.participantsTableHeaderCell, styles.participantsTableCellDni, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>DNI</Text>
                  <Text style={[styles.participantsTableHeaderCell, styles.participantsTableCellEmail, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>Correo</Text>
                  <Text style={[styles.participantsTableHeaderCell, styles.participantsTableCellEntidad, { color: colorScheme === 'dark' ? '#ccc' : '#333' }]}>Entidad</Text>
                </View>

              {/* Tabla rows */}
              {allParticipants
                .filter(p => {
                  // Filtro de modo
                  if (modalFilterMode !== 'todos') {
                    if (modalFilterMode === 'registro' && !p.estado?.registrado) return false;
                    if (modalFilterMode === 'aula_magna' && !p.estado?.en_aula_magna) return false;
                    if (modalFilterMode === 'master_class' && !p.estado?.en_master_class) return false;
                    if (modalFilterMode === 'cena' && !p.estado?.en_cena) return false;
                  }
                  // Filtro de búsqueda
                  if (modalSearchText.trim()) {
                    const searchLower = modalSearchText.toLowerCase().trim();
                    const searchFields = [
                      p.nombre, p.dni, p.email, p.entitat, p.escuela, p.cargo, p.telefono, p.acceso
                    ].filter(Boolean).join(' ').toLowerCase();
                    if (!searchFields.includes(searchLower)) return false;
                  }
                  return true;
                })
                .map((participant, index) => (
                <View
                  key={participant.dni}
                  style={[
                    styles.participantsTableRow,
                    {
                      backgroundColor: index % 2 === 0
                        ? (colorScheme === 'dark' ? 'transparent' : '#fff')
                        : (colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'),
                      borderBottomColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    }
                  ]}
                >
                  <Text
                    style={[styles.participantsTableCell, styles.participantsTableCellNombre, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
                    numberOfLines={1}
                  >
                    {participant.nombre}
                  </Text>
                  <View style={[styles.participantsTableCell, styles.participantsTableCellUbicacion]}>
                    <View style={styles.ubicacionBadgesRow}>
                      {participant.estado?.en_aula_magna && (
                        <View style={[styles.ubicacionBadge, { backgroundColor: Colors.light.modeAulaMagna }]}>
                          <Text style={styles.ubicacionBadgeText}>Aula</Text>
                        </View>
                      )}
                      {participant.estado?.en_master_class && (
                        <View style={[styles.ubicacionBadge, { backgroundColor: Colors.light.modeMasterClass }]}>
                          <Text style={styles.ubicacionBadgeText}>MC</Text>
                        </View>
                      )}
                      {participant.estado?.en_cena && (
                        <View style={[styles.ubicacionBadge, { backgroundColor: Colors.light.modeCena }]}>
                          <Text style={styles.ubicacionBadgeText}>Cena</Text>
                        </View>
                      )}
                      {!participant.estado?.en_aula_magna && !participant.estado?.en_master_class && !participant.estado?.en_cena && (
                        <Text style={{ color: colorScheme === 'dark' ? '#666' : '#999', fontSize: 11 }}>-</Text>
                      )}
                    </View>
                  </View>
                  <Text
                    style={[styles.participantsTableCell, styles.participantsTableCellDni, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}
                    numberOfLines={1}
                  >
                    {participant.dni}
                  </Text>
                  <Text
                    style={[styles.participantsTableCell, styles.participantsTableCellEmail, { color: colorScheme === 'dark' ? '#ddd' : '#333' }]}
                    numberOfLines={1}
                  >
                    {participant.email || '-'}
                  </Text>
                  <Text
                    style={[styles.participantsTableCell, styles.participantsTableCellEntidad, { color: colorScheme === 'dark' ? '#ddd' : '#333' }]}
                    numberOfLines={1}
                  >
                    {participant.entitat || participant.escuela || '-'}
                  </Text>
                </View>
              ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.light.primary,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 48,
  },
  loginContainer: {
    position: 'absolute',
    right: Spacing.md,
    top: Spacing.md,
    zIndex: 9999,
    elevation: 9999, // Para Android
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  // Estilos de selector de modo (unificado)
  modeSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  // Contenedor de fila para hamburguesa + selector
  modeRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  // Botón de menú hamburguesa
  hamburgerButton: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerIcon: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Selector de modo contraído
  modeSelectorCollapsed: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  modeIconLarge: {
    fontSize: 40,
  },
  modeTextLarge: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  // Botón para cerrar el menú expandido
  closeMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  closeMenuIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeMenuText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  // Selector de modo expandido
  modeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  modeButton: {
    flex: 1,
    minWidth: '22%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modeIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  modeText: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Controles de escaneo
  scanControls: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  directionSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  directionButton: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  directionButtonActive: {
    // backgroundColor se aplica dinámicamente
  },
  directionButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  directionButtonTextActive: {
    color: '#fff',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  scanButtonIcon: {
    fontSize: 32,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
  },
  divider: {
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: Spacing.md,
    marginHorizontal: Spacing.md,
  },
  // Sección de estadísticas
  statsSection: {
    paddingHorizontal: Spacing.md,
  },
  // Fila de indicadores
  indicatorsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  indicatorCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  indicatorNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  indicatorLabel: {
    fontSize: FontSizes.sm,
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
  },
  // Sección de accesos recientes
  recentAccessSection: {
    marginTop: Spacing.md,
  },
  subsectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    opacity: 0.8,
  },
  logsContainer: {
    gap: Spacing.xs,
  },
  logCard: {
    flexDirection: 'row',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  logInfo: {
    flex: 1,
  },
  logName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  logDni: {
    fontSize: FontSizes.sm,
    opacity: 0.6,
    marginTop: 2,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginTop: 2,
  },
  logDirectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logDirectionText: {
    fontSize: 14,
  },
  logTime: {
    fontSize: FontSizes.xs,
    opacity: 0.7,
    minWidth: 45,
    textAlign: 'right',
  },
  logDetail: {
    fontSize: FontSizes.xs,
    opacity: 0.7,
    marginTop: 2,
  },
  logPermisosRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  logPermisoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  logPermisoText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  // Estilos antiguos (mantenidos para compatibilidad)
  counterContainer: {
    padding: Spacing.lg,
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  counterNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  counterLabel: {
    fontSize: FontSizes.lg,
    color: '#fff',
    marginTop: 5,
  },
  listContent: {
    paddingBottom: Spacing.lg,
  },
  participantCard: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  participantDni: {
    fontSize: FontSizes.md,
    opacity: 0.7,
  },
  participantBadges: {
    flexDirection: 'row',
    gap: 5,
  },
  badge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    opacity: 0.6,
  },
  // Event banner styles
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  eventBannerIcon: {
    fontSize: 20,
  },
  eventBannerText: {
    flex: 1,
  },
  eventBannerLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  eventBannerName: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
  },
  eventBannerChangeIcon: {
    fontSize: 18,
    marginLeft: Spacing.sm,
  },
  // Event Selector Modal styles
  eventSelectorModal: {
    flex: 1,
    paddingTop: 60,
  },
  eventSelectorHeader: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  eventSelectorLogo: {
    width: 160,
    height: 55,
    marginBottom: Spacing.lg,
  },
  eventSelectorTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  eventSelectorSubtitle: {
    fontSize: FontSizes.md,
    opacity: 0.7,
    textAlign: 'center',
  },
  eventSelectorLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventSelectorEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  eventSelectorEmptyIcon: {
    fontSize: 80,
    marginBottom: Spacing.lg,
  },
  eventSelectorEmptyText: {
    fontSize: FontSizes.lg,
    textAlign: 'center',
    opacity: 0.7,
  },
  eventSelectorList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  eventSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  eventSelectorCardContent: {
    flex: 1,
  },
  eventSelectorCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  eventSelectorCardName: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    flex: 1,
  },
  eventStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  eventStatusBadgeText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  eventSelectorCardDate: {
    fontSize: FontSizes.sm,
    marginBottom: 4,
  },
  eventSelectorCardLocation: {
    fontSize: FontSizes.sm,
  },
  eventSelectorCardArrow: {
    fontSize: 24,
    color: Colors.light.primary,
    marginLeft: Spacing.md,
  },
  eventSelectorFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  eventSelectorCancelButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  eventSelectorCancelText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  eventSelectorBackRow: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  eventSelectorBackButton: {
    padding: Spacing.sm,
  },
  eventSelectorBackText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  // ==================== ESTILOS WEB ====================
  // Layout de dos columnas para web
  webTwoColumnContainer: {
    flexDirection: 'row',
    flex: 1,
    gap: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  webLeftColumn: {
    flex: 2,
    minWidth: 320,
    display: 'flex',
    flexDirection: 'column',
  },
  webRightColumn: {
    flex: 3,
    minWidth: 400,
    display: 'flex',
    flexDirection: 'column',
  },
  // Selector de modo siempre visible en web (horizontal como móvil)
  modeSelectorWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  modeButtonWeb: {
    flex: 1,
    minWidth: '22%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  // Botones de dirección deshabilitados
  directionButtonDisabled: {
    opacity: 0.4,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  directionButtonTextDisabled: {
    opacity: 0.5,
  },
  // Contenedor de cámara inline (usa flex para llenar espacio disponible)
  inlineCameraContainer: {
    flex: 1,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 200,
  },
  // Sección de logs para web (usa flex para llenar espacio disponible)
  webLogsSection: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
    display: 'flex',
    flexDirection: 'column',
  },
  webSubsectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    color: '#000',
  },
  webLogsScrollContainer: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  // Estilos de tabla para web
  webTableHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  webTableHeaderCell: {
    fontWeight: 'bold',
    fontSize: FontSizes.sm,
    color: '#333',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.1)',
    paddingRight: Spacing.sm,
  },
  webTableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
  },
  webTableCell: {
    fontSize: FontSizes.sm,
    color: '#000',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.1)',
    paddingRight: Spacing.sm,
  },
  // Anchos de columnas de tabla
  webTableCellNombre: {
    flex: 1.2,
    minWidth: 80,
  },
  webTableCellDni: {
    flex: 1,
    minWidth: 80,
  },
  webTableCellEmail: {
    flex: 1.5,
    minWidth: 100,
  },
  webTableCellEntidad: {
    flex: 0.8,
    minWidth: 70,
  },
  webTableCellCargo: {
    flex: 0.8,
    minWidth: 70,
  },
  webTableCellDir: {
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.1)',
  },
  webTableCellHora: {
    width: 165,
    textAlign: 'right',
    borderRightWidth: 0,
  },
  // Hint para indicadores clickeables
  indicatorsHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    opacity: 0.8,
  },
  // Modal de participantes
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  participantsModalContent: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.strong,
  },
  participantsModalHeader: {
    padding: Spacing.md,
    paddingRight: 50,
    position: 'relative',
  },
  participantsModalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: '#fff',
  },
  participantsModalCount: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  participantsModalClose: {
    position: 'absolute',
    right: Spacing.sm,
    top: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantsModalCloseText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  participantsModalEmpty: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  participantsModalEmptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  participantsModalEmptyText: {
    fontSize: FontSizes.md,
    textAlign: 'center',
  },
  participantsTableScrollWrapper: {
    maxHeight: 400,
    overflow: 'auto' as const,
    // @ts-ignore - Web specific properties
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
  },
  participantsTableContainer: {
    minWidth: 600,
  },
  participantsTableHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  participantsTableHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  participantsTableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
  },
  participantsTableCell: {
    fontSize: 13,
    paddingRight: Spacing.xs,
  },
  participantsTableCellNombre: {
    flex: 2,
    minWidth: 120,
  },
  participantsTableCellDni: {
    flex: 1,
    minWidth: 80,
  },
  participantsTableCellEmail: {
    flex: 2,
    minWidth: 120,
  },
  participantsTableCellEntidad: {
    flex: 1.5,
    minWidth: 100,
  },
  participantsTableCellUbicacion: {
    flex: 1,
    minWidth: 80,
    justifyContent: 'center',
  },
  ubicacionBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  ubicacionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ubicacionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  // Filtros del modal
  modalFiltersContainer: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  modalSearchIcon: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontSize: 14,
  },
  modalSearchClear: {
    fontSize: 16,
    color: '#999',
    padding: Spacing.xs,
  },
  modalModeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  modalModeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  modalModeButtonActive: {
    backgroundColor: Colors.light.primary,
  },
  modalModeButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  modalModeButtonTextActive: {
    color: '#fff',
  },
  modalResultsCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  // Filtro de fecha para logs
  dateFilterContainer: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  dateFilterButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
  },
  dateFilterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Buscador de logs
  logsSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  logsSearchIcon: {
    fontSize: 14,
    marginRight: Spacing.xs,
  },
  logsSearchInput: {
    flex: 1,
    paddingVertical: Spacing.xs,
    fontSize: 13,
  },
  logsSearchClear: {
    fontSize: 14,
    color: '#999',
    padding: Spacing.xs,
  },
});
