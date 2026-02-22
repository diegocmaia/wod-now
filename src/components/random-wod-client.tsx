'use client';

import { useMemo, useRef, useState } from 'react';

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

const RANDOM_WOD_REQUEST_TIMEOUT_MS = 5000;

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
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const controlsSectionRef = useRef<HTMLElement | null>(null);
  const [uiState, setUiState] = useState<UiState>({
    status: 'idle',
    message: null,
    workout: null
  });

  const equipmentCount = useMemo(() => selectedEquipment.length, [selectedEquipment]);
  const selectedTimeCapLabel = useMemo(
    () => TIME_CAP_OPTIONS.find((option) => option.value === timeCapMax)?.label ?? 'No limit',
    [timeCapMax]
  );
  const hasWorkout = uiState.workout !== null;

  const toggleEquipment = (equipment: string) => {
    setSelectedEquipment((current) =>
      current.includes(equipment)
        ? current.filter((item) => item !== equipment)
        : [...current, equipment]
    );
  };

  const safeTrack = (eventName: string, props?: Record<string, string | number | boolean>) => {
    try {
      trackAnalyticsEvent(eventName, props);
    } catch {
      // Ignore analytics failures so primary interactions never break.
    }
  };

  const fetchRandomWorkout = async () => {
    if (uiState.status === 'loading') {
      return;
    }

    safeTrack('random_workout_requested', {
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, RANDOM_WOD_REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
    } catch (error) {
      const isTimeoutError =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError');
      safeTrack('api_error', {
        route: '/api/workouts/random',
        status: 0,
        code: isTimeoutError ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR'
      });
      setUiState({
        status: 'error',
        message: isTimeoutError
          ? 'Request timed out. Please try again.'
          : 'Could not reach the server. Please try again.',
        workout: null
      });
      return;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const apiError = await toApiError(response);
      safeTrack('api_error', {
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
      safeTrack('api_error', {
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
    safeTrack('workout_rendered', {
      source: 'random',
      equipment_count: payload.equipment.length,
      time_cap_seconds: payload.timeCapSeconds
    });
    setFiltersExpanded(false);
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

  const toggleFilters = () => {
    setFiltersExpanded((current) => !current);
  };

  const openFilters = () => {
    setFiltersExpanded(true);
    controlsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className={`page${hasWorkout ? ' page-has-result' : ''}`}>
      <header className="page-brand">
        <p className="panel-kicker">Random CrossFit Workout</p>
        <h1 className="panel-title page-brand-title">WOD Now</h1>
        <p className="muted page-brand-copy">
          Choose a few limits and draw one clean, published workout.
        </p>
      </header>

      <section className="result" aria-live="polite" id="result-panel">
        <div className="result-header-row">
          <p className="panel-kicker">Result</p>
          {hasWorkout ? (
            <button
              type="button"
              className="button-secondary result-filter-button"
              onClick={openFilters}
            >
              Edit filters
            </button>
          ) : null}
        </div>
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

      <section className={`controls${hasWorkout ? ' controls-with-result' : ''}`} ref={controlsSectionRef}>
        <p className="panel-kicker">Filters</p>

        {hasWorkout ? (
          <>
            <p className="muted controls-summary">
              Time cap:
              {' '}
              {selectedTimeCapLabel}
              {' • '}
              Equipment:
              {' '}
              {equipmentCount}
              {' • '}
              No-repeat:
              {' '}
              {excludeHistory.length}
            </p>
            <div className="controls-top-actions">
              <button
                type="button"
                onClick={toggleFilters}
                className="button-secondary controls-toggle"
                aria-expanded={filtersExpanded}
              >
                {filtersExpanded ? 'Hide filters' : 'Edit filters'}
              </button>
              <button
                type="button"
                onClick={fetchRandomWorkout}
                disabled={uiState.status === 'loading'}
                className="button-primary controls-redraw"
              >
                {uiState.status === 'loading' ? 'Finding workout...' : 'Draw again'}
              </button>
            </div>
          </>
        ) : (
          <p className="muted controls-summary">Set limits, then draw a workout.</p>
        )}

        <div className={`controls-body${hasWorkout && !filtersExpanded ? ' controls-body-collapsed' : ''}`}>
          <div className="controls-divider" />

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
              {uiState.status === 'loading' ? 'Finding workout...' : hasWorkout ? 'Draw again' : 'Draw workout'}
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
          {uiState.status === 'loading' ? (
            <p className="muted controls-feedback">Finding workout...</p>
          ) : null}
          {uiState.status === 'error' && uiState.message ? (
            <p className="error controls-feedback">{uiState.message}</p>
          ) : null}
          <p className="muted session-meta">
            No-repeat history: {excludeHistory.length}
          </p>
        </div>
      </section>
    </main>
  );
}
