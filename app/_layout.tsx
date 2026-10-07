import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDatabase } from '../src/database/db';
import { useQoSStore } from '../src/store/useQoSStore';

export default function RootLayout() {
  useEffect(() => {
    // Initialize local SQLite database and pre-load benchmark history
    try {
      getDatabase();
      useQoSStore.getState().loadHistory();
    } catch (e) {
      console.warn('SQLite init deferred:', e);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0D1117' },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
