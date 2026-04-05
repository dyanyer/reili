import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Dimensions, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Navigation from "./navigation";
import "./global.css";

const { width, height } = Dimensions.get('window');

function LoadingScreen() {
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const ring1Scale = useRef(new Animated.Value(0.8)).current;
  const ring1Opacity = useRef(new Animated.Value(0.08)).current;

  useEffect(() => {
    // Logo spring in
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 80,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Text fades in after logo
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    // Pulsing background ring
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ring1Scale, { toValue: 1.15, duration: 2000, useNativeDriver: true }),
          Animated.timing(ring1Opacity, { toValue: 0.04, duration: 2000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ring1Scale, { toValue: 0.8, duration: 2000, useNativeDriver: true }),
          Animated.timing(ring1Opacity, { toValue: 0.1, duration: 2000, useNativeDriver: true }),
        ]),
      ])
    ).start();

    // Loading dots — staggered pulse
    function pulseDot(dot: Animated.Value, delay: number) {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay(400),
        ])
      ).start();
    }
    pulseDot(dot1, 600);
    pulseDot(dot2, 900);
    pulseDot(dot3, 1200);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Decorative circles */}
      <Animated.View
        style={[
          styles.decorCircleLarge,
          { transform: [{ scale: ring1Scale }], opacity: ring1Opacity },
        ]}
      />
      <View style={styles.decorCircleTopRight} />
      <View style={styles.decorCircleBottomLeft} />

      {/* Center content */}
      <View style={styles.centerContent}>
        {/* Glow ring behind logo */}
        <View style={styles.logoGlow}>
          <Animated.View
            style={[
              styles.logoContainer,
              {
                transform: [{ scale: logoScale }],
                opacity: logoOpacity,
              },
            ]}
          >
            <Image
              source={require('./assets/reili.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* App name */}
        <Animated.Text style={[styles.appName, { opacity: titleOpacity }]}>
          Reili
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Replies that work for you
        </Animated.Text>
      </View>

      {/* Loading dots */}
      <Animated.View style={[styles.dotsContainer, { opacity: taglineOpacity }]}>
        <Animated.View style={[styles.dot, { opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { opacity: dot3 }]} />
      </Animated.View>

      {/* Bottom tagline */}
      <Animated.Text style={[styles.bottomText, { opacity: taglineOpacity }]}>
        For Filipino sellers
      </Animated.Text>
    </View>
  );
}

export default function App() {
  const [showLoading, setShowLoading] = useState(true);
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start(() => setShowLoading(false));
    }, 2400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {!showLoading && <Navigation />}
      {showLoading && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: screenOpacity }]}>
          <LoadingScreen />
        </Animated.View>
      )}
    </>
  );
}

const NAVY = '#0E1C40';
const CYAN = '#00C5FF';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorCircleLarge: {
    position: 'absolute',
    width: width * 1.4,
    height: width * 1.4,
    borderRadius: width * 0.7,
    borderWidth: 60,
    borderColor: CYAN,
    opacity: 0.06,
  },
  decorCircleTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: CYAN,
    opacity: 0.06,
  },
  decorCircleBottomLeft: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: CYAN,
    opacity: 0.05,
  },
  centerContent: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoGlow: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 197, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 12,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 72,
    height: 72,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: 8,
  },
  tagline: {
    color: CYAN,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    bottom: height * 0.18,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: CYAN,
  },
  bottomText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    position: 'absolute',
    bottom: height * 0.07,
  },
});
