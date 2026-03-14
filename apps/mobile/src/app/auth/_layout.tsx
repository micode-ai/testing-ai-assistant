import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#F1F5F9',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#0F172A' },
      }}
    >
      <Stack.Screen
        name="login"
        options={{ title: 'Sign In', headerShown: false }}
      />
      <Stack.Screen
        name="register"
        options={{ title: 'Create Account', headerBackTitle: 'Back' }}
      />
    </Stack>
  );
}
