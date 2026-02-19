import { ImageResponse } from 'next/og';

export const alt = 'WOD Now preview card';
export const size = {
  width: 1200,
  height: 630
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          background: 'linear-gradient(135deg, #0f172a 0%, #0b3a75 45%, #1d4ed8 100%)',
          color: '#f8fafc',
          padding: '72px',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontFamily: 'Helvetica'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 30,
            letterSpacing: 3,
            textTransform: 'uppercase',
            opacity: 0.85
          }}
        >
          WOD NOW
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 82, fontWeight: 800, lineHeight: 1.05 }}>
            Random Workout.
            <br />
            Ready to Share.
          </div>
          <div style={{ fontSize: 34, opacity: 0.9 }}>
            Fast CrossFit WOD discovery and publishing.
          </div>
        </div>
      </div>
    ),
    size
  );
}
