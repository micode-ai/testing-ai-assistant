import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: '#334155', text: '#CBD5E1' },
  success: { bg: '#064E3B', text: '#34D399' },
  error: { bg: '#7F1D1D', text: '#FCA5A5' },
  warning: { bg: '#78350F', text: '#FCD34D' },
  info: { bg: '#1E3A5F', text: '#93C5FD' },
};

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  const colors = variantColors[variant];

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
