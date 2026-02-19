'use client';

import { useMemo, useState } from 'react';

import { trackAnalyticsEvent } from '../lib/analytics.js';
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
  status: 'idle' | 'loading' | 'error' | 'empty' | 'success';
  message: string | null;
  workout: WorkoutView | null;
};

const toApiError = async (
  response: Response
): Promise<{ message: string; code?: string }> => {
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
      const code =
        'code' in payload.error && typeof payload.error.code === 'string'
          ? payload.error.code
          : undefined;

      return {
        message: payload.error.message,
        code
      };
    }
  } catch {
    return { message: `Request failed with status ${response.status}` };
  }

  return { message: `Request failed with status ${response.status}` };
};

export function RandomWodClient() {
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [timeCapMax, setTimeCapMax] = useState('');
  const [excludeHistory, setExcludeHistory] = useState<string[]>([]);
  const [uiState, setUiState] = useState<UiState>({
    status: 'idle',
    message: null,
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
    trackAnalyticsEvent('random_workout_requested', {
      has_time_cap_filter: timeCapMax.length > 0,
      equipment_count: selectedEquipment.length,
      exclude_count: excludeHistory.length
    });

    setUiState((state) => ({ ...state, status: 'loading', message: null }));

    const query = new URLSearchParams();
    if (timeCapMax.length > 0) {
      query.set('timeCapMax', timeCapMax);
    }
    if (selectedEquipment.length > 0) {
      query.set('equipment', selectedEquipment.join(','));
    }
    if (excludeHistory.length > 0) {
      query.set('exclude', excludeHistory.join(','));
    }

    const endpoint = `/api/workouts/random${query.toString() ? `?${query}` : ''}`;
    let response: Response;
    try {
      response = await fetch(endpoint, { method: 'GET', cache: 'no-store' });
    } catch {
      trackAnalyticsEvent('api_error', {
        route: '/api/workouts/random',
        status: 0,
        code: 'NETWORK_ERROR'
      });
      setUiState({
        status: 'error',
        message: 'Could not reach the server. Please try again.',
        workout: null
      });
      return;
    }

    if (!response.ok) {
      const apiError = await toApiError(response);
      trackAnalyticsEvent('api_error', {
        route: '/api/workouts/random',
        status: response.status,
        code: apiError.code ?? 'UNKNOWN'
      });
      setUiState({
        status: response.status === 404 ? 'empty' : 'error',
        message: apiError.message,
        workout: null
      });
      return;
    }

    const payload = parseWorkoutView(await response.json());
    if (payload === null) {
      trackAnalyticsEvent('api_error', {
        route: '/api/workouts/random',
        status: 200,
        code: 'INVALID_PAYLOAD'
      });
      setUiState({
        status: 'error',
        message: 'API returned an invalid workout payload',
        workout: null
      });
      return;
    }

    setExcludeHistory((current) =>
      current.includes(payload.id) ? current : [...current, payload.id]
    );
    trackAnalyticsEvent('workout_rendered', {
      source: 'random',
      equipment_count: payload.equipment.length,
      time_cap_seconds: payload.timeCapSeconds
    });
    setUiState({
      status: 'success',
      message: null,
      workout: payload
    });
  };

  const clearHistory = () => {
    setExcludeHistory([]);
    setUiState((current) => ({
      ...current,
      status: current.workout ? 'success' : 'idle',
      message: null
    }));
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

        <div className="controls-actions">
          <button
            type="button"
            onClick={fetchRandomWorkout}
            disabled={uiState.status === 'loading'}
            className="button-primary"
          >
            {uiState.status === 'loading' ? 'Finding workout...' : 'Get random workout'}
          </button>
          <button
            type="button"
            onClick={clearHistory}
            disabled={excludeHistory.length === 0}
            className="button-secondary"
          >
            Reset no-repeat history
          </button>
        </div>
        <p className="muted session-meta">
          Excluded this session:
          {' '}
          {excludeHistory.length}
        </p>
      </section>

      <section className="result" aria-live="polite">
        {uiState.status === 'error' && uiState.message ? <p className="error">{uiState.message}</p> : null}
        {uiState.workout ? (
          <WorkoutRenderer workout={uiState.workout} />
        ) : uiState.status === 'empty' ? (
          <article className="workout-card">
            <h2>No workouts left for current filters</h2>
            <p className="muted">{uiState.message ?? 'Try broadening filters or reset no-repeat history.'}</p>
          </article>
        ) : (
          <p className="muted">
            {uiState.status === 'loading'
              ? 'Finding workout...'
              : 'No workout selected yet.'}
          </p>
        )}
      </section>
    </main>
  );
}
