import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image metadata
export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

// Image generation
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a2540 0%, #1a5db5 100%)',
          borderRadius: '22%',
        }}
      >
        {/* Leaf / carbon-leaf icon mark */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Stylised leaf representing carbon sequestration */}
          <path
            d="M60 10 C90 10, 110 35, 110 60 C110 90, 85 110, 60 110 C35 110, 10 90, 10 60 C10 35, 30 10, 60 10 Z"
            fill="#00d4aa"
            opacity="0.9"
          />
          {/* Central vein */}
          <path
            d="M60 100 C60 100, 55 70, 50 50 C45 30, 60 15, 60 15"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
          {/* Left veins */}
          <path
            d="M57 80 C45 75, 32 70, 25 60"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          <path
            d="M54 65 C44 58, 35 52, 28 44"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          {/* Right veins */}
          <path
            d="M63 80 C75 75, 88 70, 95 60"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          <path
            d="M66 65 C76 58, 85 52, 92 44"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          {/* "C" letterform overlay */}
          <text
            x="60"
            y="72"
            textAnchor="middle"
            fontSize="36"
            fontWeight="800"
            fill="white"
            fontFamily="system-ui, sans-serif"
            opacity="0.95"
          >
            CS
          </text>
        </svg>
      </div>
    ),
    {
      ...size,
    },
  )
}
