import { FiSun, FiMoon } from 'react-icons/fi';
import useTheme from '../../hooks/useTheme';

export default function ThemeToggle({ className = '' }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
        text-gray-500 hover:text-gray-900 hover:bg-gray-100
        dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10
        ${className}`}
    >
      {dark ? <FiSun size={17} /> : <FiMoon size={17} />}
    </button>
  );
}
