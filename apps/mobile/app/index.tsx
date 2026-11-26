import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { WebView as RNWebView, type WebViewNavigation } from 'react-native-webview';

// react-native-webview 14 typings clash with RN 0.86 JSX typings; keep the runtime component, loosen props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WebView: any = RNWebView;
import { SafeAreaView } from 'react-native-safe-area-context';

const VIOLET = '#6f52ed';
const CREAM = '#fbf7f2';
const INK = '#1d1730';

const extra = (Constants.expoConfig?.extra ?? {}) as { webUrl?: string };
const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || extra.webUrl || 'https://new-business.getbooqi.tech/').trim();

const INTERNAL_HOSTS = ['new-business.getbooqi.tech', 'getbooqi.tech'];
function isInternal(url: string): boolean {
  const m = /^(https?):\/\/([^/:?#]+)/i.exec(url);
  if (!m) return url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:');
  const host = m[2].toLowerCase();
  return INTERNAL_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

const PLATFORM = Platform.OS === 'ios' ? 'ios' : 'android';
// Runs before page scripts: lets the web hub pick IOS_BUSINESS / ANDROID_BUSINESS for the login `app` field.
const INJECT = `window.__BOOQI_APP__ = ${JSON.stringify(PLATFORM)}; true;`;

export default function Shell() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);
  const canGoBack = useRef(false);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current) {
        ref.current?.goBack();
        return true;
      }
      return false; // exit the app
    });
    return () => sub.remove();
  }, []);

  const onNav = useCallback((n: WebViewNavigation) => {
    canGoBack.current = n.canGoBack;
  }, []);

  const retry = useCallback(() => {
    setOffline(false);
    setLoading(true);
    ref.current?.reload();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <WebView
          ref={ref}
          source={{ uri: WEB_URL }}
          style={[styles.root, offline && styles.hidden]}
          containerStyle={styles.root}
          injectedJavaScriptBeforeContentLoaded={INJECT}
          onNavigationStateChange={onNav}
          onShouldStartLoadWithRequest={(req: { url: string }) => {
            if (isInternal(req.url)) return true;
            Linking.openURL(req.url).catch(() => {});
            return false;
          }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onLoad={() => setOffline(false)}
          onError={() => setOffline(true)}
          onHttpError={(e: { nativeEvent: { statusCode: number } }) => { if (e.nativeEvent.statusCode >= 500) setOffline(true); }}
          pullToRefreshEnabled={false}
          bounces={false}
          overScrollMode="never"
          decelerationRate="normal"
          allowsBackForwardNavigationGestures
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          cacheEnabled
          setSupportMultipleWindows={false}
          allowsInlineMediaPlayback
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          setBuiltInZoomControls={false}
          textZoom={100}
          startInLoadingState={false}
          backgroundColor={CREAM}
        />
        {loading && !offline && (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator color={VIOLET} />
          </View>
        )}
        {offline && (
          <View style={styles.offline}>
            <Text style={styles.title}>İnternet yoxdur</Text>
            <Pressable style={styles.btn} onPress={retry} accessibilityRole="button">
              <Text style={styles.btnText}>Yenidən cəhd et</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  hidden: { opacity: 0 },
  loader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  offline: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { color: INK, fontSize: 22, fontWeight: '700', marginBottom: 20 },
  btn: { backgroundColor: VIOLET, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
