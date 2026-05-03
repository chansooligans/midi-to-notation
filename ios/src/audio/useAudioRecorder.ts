import { useCallback, useRef } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

export function useAudioRecorder() {
  const recordingRef = useRef<Audio.Recording | null>(null);

  const start = useCallback(async () => {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    recordingRef.current = recording;
  }, []);

  const stop = useCallback(async (): Promise<string | null> => {
    const recording = recordingRef.current;
    if (!recording) return null;
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const uri = recording.getURI();
    recordingRef.current = null;
    return uri;
  }, []);

  const getFileUri = useCallback(async (uri: string): Promise<string> => {
    return uri;
  }, []);

  return { start, stop, getFileUri };
}
