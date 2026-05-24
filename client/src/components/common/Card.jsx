export default function Card({ children, className = '', hover = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm
        ${hover ? 'hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer' : ''}
        ${className}`}
    >
      {children}
    </div>
  );
}
