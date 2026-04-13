export default function Card({ children, className = '', hover = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-xl shadow-sm
        ${hover ? 'hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer' : ''}
        ${className}`}
    >
      {children}
    </div>
  );
}
