export default function Card({ children, className = '', hover = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm
        ${hover
          ? 'transition-all duration-300 ease-out cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:border-brand-300 dark:hover:border-brand-500 hover:shadow-brand-500/10'
          : ''}
        ${className}`}
    >
      {children}
    </div>
  );
}
