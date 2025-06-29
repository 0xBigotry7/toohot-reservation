interface TrendChartProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

export default function TrendChart({ 
  data, 
  width = 60, 
  height = 24, 
  color = '#B86F3A',
  className = '' 
}: TrendChartProps) {
  if (data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1 // Avoid division by zero

  // Create SVG path points
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  // Determine trend direction
  const isIncreasing = data[data.length - 1] > data[0]
  const isDecreasing = data[data.length - 1] < data[0]
  
  let strokeColor = color
  if (isIncreasing) strokeColor = '#10B981' // Green for positive trend
  if (isDecreasing) strokeColor = '#EF4444' // Red for negative trend

  // Create gradient for subtle fill
  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className={`inline-block ${className}`}>
      <svg 
        width={width} 
        height={height} 
        className="overflow-visible"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Trend line */}
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))'
          }}
        />
        
        {/* Subtle fill area */}
        <polygon
          points={`0,${height} ${points} ${width},${height}`}
          fill={`url(#${gradientId})`}
        />
        
        {/* Highlight current point */}
        <circle
          cx={(data.length - 2) / (data.length - 1) * width} // Second to last point (current)
          cy={height - ((data[data.length - 2] - min) / range) * height}
          r="2"
          fill={strokeColor}
          stroke="white"
          strokeWidth="1"
          style={{
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
          }}
        />
      </svg>
    </div>
  )
} 