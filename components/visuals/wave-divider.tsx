/**
 * Componente Wave Divider
 *
 * Crea un separador con forma de ola sinusoidal entre secciones
 * Similar al estilo usado en impulseducacio.org
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface WaveDividerProps {
  /** Color de la sección superior (por encima de la ola) */
  topColor?: string;
  /** Color de la sección inferior (por debajo de la ola) */
  bottomColor?: string;
  /** Altura de la ola en píxeles */
  height?: number;
  /** Número de ondas completas (ciclos) */
  waves?: number;
  /** Invertir la ola (si true, la curva va hacia abajo primero) */
  inverted?: boolean;
}

export const WaveDivider: React.FC<WaveDividerProps> = ({
  topColor = '#00a1e4',
  bottomColor = '#ffffff',
  height = 60,
  waves = 2,
  inverted = false,
}) => {
  /**
   * Genera el path SVG para una ola sinusoidal
   * Crea una curva suave que va de 0 a 2π * waves
   */
  const generateWavePath = () => {
    const amplitude = height / 2; // Amplitud de la onda
    const frequency = waves; // Número de ondas completas
    const points = 100; // Número de puntos para suavidad

    let path = `M 0 ${amplitude}`; // Comenzar en el centro vertical, lado izquierdo

    // Generar puntos de la curva sinusoidal
    for (let i = 0; i <= points; i++) {
      const x = (i / points) * 100; // Porcentaje del ancho (viewBox es 100)
      const radians = (i / points) * Math.PI * 2 * frequency;
      const y = amplitude + Math.sin(inverted ? radians + Math.PI : radians) * amplitude;
      path += ` L ${x} ${y}`;
    }

    // Cerrar el path: bajar a la parte inferior y volver al inicio
    path += ` L 100 ${height} L 0 ${height} Z`;

    return path;
  };

  return (
    <View style={[styles.container, { backgroundColor: bottomColor }]}>
      <Svg
        height={height}
        width="100%"
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={styles.svg}
      >
        <Path d={generateWavePath()} fill={topColor} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  svg: {
    width: '100%',
  },
});

/**
 * Variante preconfigurada: Ola azul de Impuls
 */
export const ImpulsWave: React.FC<Omit<WaveDividerProps, 'topColor'>> = (props) => (
  <WaveDivider topColor="#00a1e4" {...props} />
);

/**
 * Variante preconfigurada: Ola lila
 */
export const PurpleWave: React.FC<Omit<WaveDividerProps, 'topColor'>> = (props) => (
  <WaveDivider topColor="#ba6fb0" {...props} />
);

/**
 * Variante preconfigurada: Ola naranja
 */
export const OrangeWave: React.FC<Omit<WaveDividerProps, 'topColor'>> = (props) => (
  <WaveDivider topColor="#ff8a1f" {...props} />
);
