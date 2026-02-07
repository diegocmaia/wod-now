'use client';

import { useMemo, useState } from 'react';

import { parseWorkoutView, type WorkoutView } from '../lib/workout-view';
import { WorkoutRenderer } from './workout-renderer';

const TIME_CAP_OPTIONS = [
  { label: 'No limit', value: '' },
  { label: '10 min', value: '600' },
  { label: '12 min', value: '720' },
  { label: '15 min', value: '900' },
  { label: '20 min', value: '1200' },
  { label: '30 min', value: '1800' }
] as const;

const EQUIPMENT_OPTIONS = [
  'barbell',
  'dumbbells',
  'kettlebell',
  'pull-up bar',
  'jump rope',
  'rower',
  'bike',
  'box'
] as const;

type UiState = {
  loading: boolean;
  error: string | null;
  workout: WorkoutView | null;
};

const toApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as unknown;
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'object' &&
      payload.error !== null &&
      'message' in payload.error &&
      typeof payload.error.message === 'string'
    ) {
      return payload.error.message;
    }
  } catch {
    return `Request failed with status ${response.status}`;
  }

  return `Request failed with status ${response.status}`;
};

export function RandomWodClient() {
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [timeCapMax, setTimeCapMax] = useState('');
  const [uiState, setUiState] = useState<UiState>({
    loading: false,
    error: null,
    workout: null
  });

  const equipmentCount = useMemo(() => selectedEquipment.length, [selectedEquipment]);

  const toggleEquipment = (equipment: string) => {
    setSelectedEquipment((current) =>
      current.includes(equipment)
        ? current.filter((item) => item !== equipment)
        : [...current, equipment]
    );
  };

  const fetchRandomWorkout = async () => {
    setUiState((state) => ({ ...state, loading: true, error: null }));

    const query = new URLSearchParams();
    if (timeCapMax.length > 0) {
      query.set('timeCapMax', timeCapMax);
    }
    if (selectedEquipment.length > 0) {
      query.set('equipment', selectedEquipment.join(','));
    }

    const endpoint = `/api/workouts/random${query.toString() ? `?${query}` : ''}`;
    const response = await fetch(endpoint, { method: 'GET', cache: 'no-store' });

    if (!response.ok) {
      const message = await toApiErrorMessage(response);
      setUiState({ loading: false, error: message, workout: null });
      return;
    }

    const payload = parseWorkoutView(await response.json());
    if (payload === null) {
      setUiState({
        loading: false,
        error: 'API returned an invalid workout payload',
        workout: null
      });
      return;
    }

    setUiState({ loading: false, error: null, workout: payload });
  };

  return (
    <main className="page">
      <section className="controls">
        <h1>WOD Now</h1>
        <p className="muted">Pick your constraints and draw a random published workout.</p>

        <label htmlFor="time-cap">Time cap</label>
        <select
          id="time-cap"
          name="timeCapMax"
          value={timeCapMax}
          onChange={(event) => setTimeCapMax(event.target.value)}
        >
          {TIME_CAP_OPTIONS.map((option) => (
            <option key={option.value || 'none'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <fieldset>
          <legend>
            Equipment
            {' '}
            ({equipmentCount} selected)
          </legend>
          <div className="equipment-grid">
            {EQUIPMENT_OPTIONS.map((item) => (
              <label key={item} className="equipment-option">
                <input
                  type="checkbox"
                  checked={selectedEquipment.includes(item)}
                  onChange={() => toggleEquipment(item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="button" onClick={fetchRandomWorkout} disabled={uiState.loading}>
          {uiState.loading ? 'Finding workout...' : 'Get random workout'}
        </button>
      </section>

      <section className="result" aria-live="polite">
        {uiState.error ? <p className="error">{uiState.error}</p> : null}
        {uiState.workout ? (
          <WorkoutRenderer workout={uiState.workout} />
        ) : (
          <p className="muted">No workout selected yet.</p>
        )}
      </section>
    </main>
  );
}
