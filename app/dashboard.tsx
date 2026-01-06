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

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
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
import { Colors, BorderRadius, Spacing, Shadows, FontSizes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useApp } from '@/contexts/AppContext';
import { LoginButton } from '@/components/forms/LoginButton';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { BackButton } from '@/components/navigation/BackButton';

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

  // Contexto global para modo y dirección de escaneo
  const { setModo, setDireccion } = useApp();

  // Usuario autenticado (necesario para habilitar escaneo)
  const { user } = useAuth();

  // Evento activo (para filtrar participantes)
  const { currentEvent } = useEvent();

  // Modo/ubicación seleccionado (unificado para escaneo y estadísticas)
  const [selectedMode, setSelectedMode] = useState<AccessMode>('registro');

  // Lista de participantes en la ubicación seleccionada (actualizada en tiempo real)
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Dirección de escaneo (entrada/salida)
  const [scanDirection, setScanDirection] = useState<AccessDirection>('entrada');

  // Estado para controlar si el selector de modo está expandido
  const [modeExpanded, setModeExpanded] = useState(false);

  // Estadísticas del modo seleccionado
  const [stats, setStats] = useState<{
    uniqueEntrances: number;
    maxSimultaneous: number;
  }>({ uniqueEntrances: 0, maxSimultaneous: 0 });

  // Últimos accesos del modo seleccionado
  const [recentLogs, setRecentLogs] = useState<AccessLog[]>([]);

  // Recuentos totales de participantes por permiso
  const [potentialCounts, setPotentialCounts] = useState({
    registro: 0,
    aula_magna: 0,
    master_class: 0,
    cena: 0,
  });

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
   * Suscripción a los últimos logs y carga de estadísticas
   */
  useEffect(() => {
    const eventId = currentEvent?.id;

    // Suscribirse a los últimos 10 accesos en tiempo real
    const unsubscribeLogs = subscribeToRecentAccessLogs(selectedMode, 10, (logs) => {
      setRecentLogs(logs);
    }, eventId);

    // Cargar estadísticas
    getAccessStats(selectedMode, eventId).then((stats) => {
      setStats(stats);
    });

    return () => {
      unsubscribeLogs();
    };
  }, [selectedMode, currentEvent?.id]);

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header: Logo + Login */}
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

        {/* Current event indicator */}
        {currentEvent ? (
          <View style={[styles.eventBanner, { backgroundColor: Colors.light.success + '20' }]}>
            <Text style={[styles.eventBannerIcon]}>📅</Text>
            <View style={styles.eventBannerText}>
              <Text style={[styles.eventBannerLabel, { color: Colors.light.success }]}>
                Evento activo
              </Text>
              <Text style={[styles.eventBannerName, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
                {currentEvent.name}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.eventBanner, { backgroundColor: Colors.light.warning + '20' }]}>
            <Text style={[styles.eventBannerIcon]}>⚠️</Text>
            <Text style={[styles.eventBannerLabel, { color: Colors.light.warning }]}>
              Selecciona un evento en Administración
            </Text>
          </View>
        )}

        {/* Selector de Modo (unificado para escaneo y estadísticas) */}
        <View style={styles.modeSection}>
          <ThemedText style={styles.sectionTitle}>Selecciona el Modo</ThemedText>

          {/* Fila superior: menú hamburguesa + modo seleccionado (siempre visible) */}
          <View style={styles.modeRowContainer}>
            {/* Botón de menú hamburguesa */}
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

            {/* Modo seleccionado actual - clickable para expandir/colapsar */}
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

          {/* Opciones de modo (se muestran debajo cuando está expandido) */}
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
        {/* Selector de dirección (solo si no es registro) */}
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

        {/* Botón para abrir escáner - Solo habilitado si hay usuario autenticado */}
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

      {/* Divider */}
      <View style={styles.divider} />

      {/* Estadísticas del modo seleccionado */}
      <View style={styles.statsSection}>
        <ThemedText style={styles.sectionTitle}>
          {selectedModeInfo?.icono} {selectedModeInfo?.titulo}
        </ThemedText>

        {/* Indicadores */}
        <View style={styles.indicatorsRow}>
          {/* Indicador 1: En tiempo real */}
          <View style={[styles.indicatorCard, { backgroundColor: selectedModeInfo?.color }]}>
            <Text style={styles.indicatorNumber}>{participants.length}</Text>
            <Text style={styles.indicatorLabel}>
              {selectedMode === 'registro' ? 'Registrados' : 'Ahora mismo'}
            </Text>
          </View>

          {/* Indicador 2: Máximo histórico */}
          <View style={[styles.indicatorCard, { backgroundColor: selectedModeInfo?.color }]}>
            <Text style={styles.indicatorNumber}>{stats.maxSimultaneous}</Text>
            <Text style={styles.indicatorLabel}>
              {selectedMode === 'registro' ? 'Total' : 'Máximo'}
            </Text>
          </View>

          {/* Indicador 3: Participantes únicos */}
          {selectedMode !== 'registro' && (
            <View style={[styles.indicatorCard, { backgroundColor: selectedModeInfo?.color }]}>
              <Text style={styles.indicatorNumber}>{stats.uniqueEntrances}</Text>
              <Text style={styles.indicatorLabel}>Han entrado</Text>
            </View>
          )}

          {/* Indicador de Previstos */}
          <View style={[styles.indicatorCard, { backgroundColor: selectedModeInfo?.color, opacity: 0.8 }]}>
            <Text style={styles.indicatorNumber}>{potentialCounts[selectedMode]}</Text>
            <Text style={styles.indicatorLabel}>Previstos</Text>
          </View>
        </View>

        {/* Últimos accesos */}
        <View style={styles.recentAccessSection}>
          <ThemedText style={styles.subsectionTitle}>
            {selectedMode === 'registro' ? 'Últimos registros' : 'Últimos accesos'}
          </ThemedText>

          {recentLogs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <ThemedText style={styles.emptyText}>
                {selectedMode === 'registro'
                  ? 'Aún no hay registros'
                  : 'Aún no hay accesos registrados'}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.logsContainer}>
              {recentLogs.map((log, index) => (
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
                    {/* Badges de permisos */}
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
                    {log.direccion && (
                      <View style={[
                        styles.logDirectionBadge,
                        { backgroundColor: log.direccion === 'entrada'
                          ? Colors.light.directionEntrada
                          : Colors.light.directionSalida
                        }
                      ]}>
                        <Text style={styles.logDirectionText}>
                          {log.direccion === 'entrada' ? '⬇️' : '⬆️'}
                        </Text>
                      </View>
                    )}
                    <ThemedText style={styles.logTime}>
                      {new Date(log.timestamp).toLocaleTimeString('es-ES', {
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
    <View style={styles.footer}>
        <BackButton style={{ margin: 0 }} />
    </View>
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
});
