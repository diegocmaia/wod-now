import { ImageResponse } from 'next/og';

export const alt = 'WOD Now Twitter card';
export const size = {
  width: 1200,
  height: 600
};
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          background: 'linear-gradient(90deg, #0f172a 0%, #1e3a8a 65%, #2563eb 100%)',
          color: '#f8fafc',
          padding: '60px 72px',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'Helvetica'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 26, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.9 }}>
            WOD NOW
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 68, fontWeight: 800, lineHeight: 1.06 }}>
            Random CrossFit
            <br />
            Workouts
          </div>
          <div style={{ fontSize: 30, opacity: 0.9 }}>Generate. Share. Train.</div>
        </div>
      </div>
    ),
    size
  );
}
