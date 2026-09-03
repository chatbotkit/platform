export default function Initials({ initials, ...props }) {
  return (
    <svg {...props} width="100" height="100" viewBox="0 0 100 100">
      <text
        x="52%"
        y="52%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="inherit"
        fontSize="40"
        style={{ userSelect: 'none' }}
      >
        {initials}
      </text>
    </svg>
  )
}
