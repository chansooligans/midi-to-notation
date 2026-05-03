import { useRef, useCallback, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

const OSMD_HTML = require("../../assets/osmd/osmd.html");

interface Props {
  musicXml: string | null;
  onRendered?: () => void;
  onError?: (msg: string) => void;
}

export function NotationWebView({ musicXml, onRendered, onError }: Props) {
  const webViewRef = useRef<WebView>(null);
  const pendingXml = useRef<string | null>(null);
  const isReady = useRef(false);

  const sendXml = useCallback((xml: string) => {
    webViewRef.current?.postMessage(
      JSON.stringify({ type: "render", musicxml: xml }),
    );
  }, []);

  useEffect(() => {
    if (musicXml && isReady.current) {
      sendXml(musicXml);
    } else if (musicXml) {
      pendingXml.current = musicXml;
    }
  }, [musicXml, sendXml]);

  const onLoad = useCallback(() => {
    isReady.current = true;
    if (pendingXml.current) {
      sendXml(pendingXml.current);
      pendingXml.current = null;
    }
  }, [sendXml]);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "rendered") onRendered?.();
        if (data.type === "error") onError?.(data.message);
      } catch {}
    },
    [onRendered, onError],
  );

  return (
    <View style={s.container}>
      <WebView
        ref={webViewRef}
        source={OSMD_HTML}
        style={s.webview}
        onLoad={onLoad}
        onMessage={onMessage}
        originWhitelist={["*"]}
        javaScriptEnabled
        scrollEnabled
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: "#1a1a2e" },
});
