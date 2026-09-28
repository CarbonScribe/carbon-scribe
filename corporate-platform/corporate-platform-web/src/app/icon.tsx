import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image metadata — Next.js will generate multiple sizes
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
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
          borderRadius: '20%',
        }}
      >
        {/* Simplified leaf mark for small sizes */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M11 2 C17 2, 20 6, 20 11 C20 17, 16 20, 11 20 C6 20, 2 17, 2 11 C2 6, 5 2, 11 2 Z"
            fill="#00d4aa"
          />
          <text
            x="11"
            y="15"
            textAnchor="middle"
            fontSize="10"
            fontWeight="800"
            fill="white"
            fontFamily="system-ui, sans-serif"
          >
            C
          </text>
        </svg>
      </div>
    ),
    {
      ...size,
    },
  )
}
