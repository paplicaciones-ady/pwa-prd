import { useTheme } from '../theme/ThemeContext';

export function Hero({ children }: { children?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <div style={{ background: theme.primaryColor, padding: 24, color: '#fff' }}>
      {children}
    </div>
  );
}
