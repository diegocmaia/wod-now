import type { WorkoutBlock, WorkoutView } from '../lib/workout-view';

const formatDuration = (duration: WorkoutBlock['duration']): string => {
  if (duration === undefined) {
    return 'For quality';
  }
  if (duration === 'remaining') {
    return 'Remaining time';
  }
  return `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;
};

const formatMovementDetails = (blockMovement: WorkoutBlock['movements'][number]): string => {
  const details: string[] = [];

  if (blockMovement.reps !== undefined) {
    details.push(`${blockMovement.reps} reps`);
  }
  if (blockMovement.repScheme !== undefined) {
    details.push(blockMovement.repScheme.join('-'));
  }
  if (blockMovement.calories !== undefined) {
    details.push(`${blockMovement.calories} cal`);
  }
  if (blockMovement.distanceMeters !== undefined) {
    details.push(`${blockMovement.distanceMeters} m`);
  }
  if (blockMovement.load) {
    details.push(blockMovement.load);
  }
  if (blockMovement.loads?.female) {
    details.push(`♀ ${blockMovement.loads.female}`);
  }
  if (blockMovement.loads?.male) {
    details.push(`♂ ${blockMovement.loads.male}`);
  }

  return details.join(' • ');
};

type WorkoutRendererProps = {
  workout: WorkoutView;
};

export function WorkoutRenderer({ workout }: WorkoutRendererProps) {
  return (
    <article className="workout-card">
      <header>
        <h2>{workout.title}</h2>
        <p className="muted">
          {Math.floor(workout.timeCapSeconds / 60)} min cap
          {' • '}
          {workout.id}
        </p>
        <div className="equipment-list">
          {workout.equipment.length > 0 ? (
            workout.equipment.map((item) => (
              <span className="pill" key={item}>
                {item}
              </span>
            ))
          ) : (
            <span className="muted">No equipment required</span>
          )}
        </div>
      </header>

      <div className="block-list">
        {workout.data.blocks.map((block, blockIndex) => (
          <section key={`${workout.id}-${block.name}-${blockIndex}`} className="block">
            <h3>{block.name}</h3>
            <p className="muted">
              {formatDuration(block.duration)}
              {block.repScheme ? ` • ${block.repScheme.join('-')}` : ''}
            </p>
            <ul>
              {block.movements.map((movement, movementIndex) => (
                <li key={`${movement.name}-${movementIndex}`}>
                  <span>{movement.name}</span>
                  <span className="muted">{formatMovementDetails(movement)}</span>
                  {movement.notes ? <em>{movement.notes}</em> : null}
                </li>
              ))}
            </ul>
            {block.notes ? <p className="muted">Block notes: {block.notes}</p> : null}
          </section>
        ))}
      </div>

      {workout.data.notes ? (
        <footer>
          {workout.data.notes.coach ? <p>Coach note: {workout.data.notes.coach}</p> : null}
          {workout.data.notes.scaling ? (
            <p className="muted">Scaling: {workout.data.notes.scaling}</p>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
