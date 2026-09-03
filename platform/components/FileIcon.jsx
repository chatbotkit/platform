import {
  getColorForExtension,
  getFileIconFontSize,
  hashString,
} from '@/lib/file.icon'
import { extname } from '@/lib/path'

/**
 * FileIcon renders a file icon SVG dynamically based on the file extension.
 * The icon color is determined by a hash of the extension for consistency.
 * The palette, hashing and markup shape are shared with lib/file.icon.ts,
 * which serves the same design as standalone svg - keep the two in step.
 *
 * @param {object} props
 * @param {string} props.name - The filename or path to extract extension from
 */
export default function FileIcon({ name, ...props }) {
  const ext = extname(name)
  const label = ext ? ext.slice(1).toUpperCase() : '?'
  const colors = getColorForExtension(ext || 'unknown')

  // @note generate unique gradient ID to avoid conflicts when multiple icons render
  const gradientId = `file-gradient-${hashString(name || 'default')}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 76.536 85.612"
      {...props}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x2="0.923"
          y2="0.966"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stopColor={colors.gradient[0]} />
          <stop offset="1" stopColor={colors.gradient[1]} />
        </linearGradient>
      </defs>
      {/* Document body */}
      <path
        d="M6,0H45.3L73,28.366V76a6,6,0,0,1-6,6H6a6,6,0,0,1-6-6V6A6,6,0,0,1,6,0Z"
        fill={`url(#${gradientId})`}
      />
      {/* Folded corner */}
      <path
        d="M23.319,2.309a3,3,0,0,1,4.362,0L46.221,21.94A3,3,0,0,1,44.04,27H6.96a3,3,0,0,1-2.181-5.06Z"
        transform="translate(57.444 51.542) rotate(-135)"
        fill={colors.fold}
      />
      {/* Extension label */}
      <text
        x="36.5"
        y="58"
        textAnchor="middle"
        fill="#ffffff"
        fontSize={getFileIconFontSize(label)}
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
      >
        {label}
      </text>
    </svg>
  )
}
