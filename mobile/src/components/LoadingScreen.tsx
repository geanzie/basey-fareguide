import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface Props {
  message?: string;
}

export default function LoadingScreen({ message = 'Loading...' }: Props) {
  return (
    <View style={s.container}>
      <ActivityIndicator color="#16a34a" size="large" />
      <Text style={s.text}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  text: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
});
