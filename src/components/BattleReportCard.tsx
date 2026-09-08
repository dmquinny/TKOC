import type { BattleReportView } from '@/lib/combat';

type Props = {
  report: BattleReportView;
  viewerPID: number;
  compact?: boolean;
};

const number = (value: number) => value.toLocaleString();

export default function BattleReportCard({ report, viewerPID, compact = false }: Props) {
  const isAttacker = report.attackerPID === viewerPID;
  const victory = isAttacker ? report.won : !report.won;
  const headline = isAttacker
    ? `${report.attackName} attack on ${report.defenderName}`
    : `${report.attackerName} launched a ${report.attackName.toLowerCase()} attack`;
  const plunder = report.gold + report.food + report.metal;
  const when = new Date(report.createdAt);

  return (
    <article className={`battle-report ${victory ? 'is-victory' : 'is-defeat'}${report.seen ? '' : ' is-unseen'}`}>
      <header className="battle-report-head">
        <span className="battle-outcome">{victory ? 'Victory' : 'Defeat'}</span>
        <div>
          <strong>{headline}</strong>
          <small>
            Age {report.age} · Tick {report.tick} · {Number.isNaN(when.getTime()) ? '' : when.toLocaleString()}
            {!report.seen ? ' · New' : ''}
          </small>
        </div>
      </header>
      <dl className="battle-report-stats">
        <div><dt>Attack strength</dt><dd>{number(report.attackPoints)}</dd></div>
        <div><dt>Defence strength</dt><dd>{number(report.defensePoints)}</dd></div>
        <div><dt>{isAttacker ? 'Your losses' : 'Attacker losses'}</dt><dd>{number(report.attackerLost)}</dd></div>
        <div><dt>{isAttacker ? 'Enemy losses' : 'Your losses'}</dt><dd>{number(report.defenderLost)}</dd></div>
        {report.acresSeized > 0 && (
          <div>
            <dt>Acres {isAttacker ? 'seized' : 'lost'}</dt>
            <dd>
              {number(report.acresSeized)}
              {isAttacker && report.acresGained > 0 ? ` (${number(report.acresGained)} on return)` : ''}
            </dd>
          </div>
        )}
        {plunder > 0 && (
          <div className="is-wide">
            <dt>{isAttacker ? 'Plunder' : 'Taken from you'}</dt>
            <dd>{number(report.gold)} gold · {number(report.food)} food · {number(report.metal)} metal</dd>
          </div>
        )}
        {report.buildingsLost > 0 && <div><dt>Buildings destroyed</dt><dd>{number(report.buildingsLost)}</dd></div>}
        {isAttacker && <div><dt>Morale lost</dt><dd>{number(report.moraleLoss)}</dd></div>}
        {isAttacker && <div><dt>Army returns</dt><dd>in {report.returnTicks} tick{report.returnTicks === 1 ? '' : 's'}</dd></div>}
        {report.targetKilled && (
          <div className="is-wide"><dt>Aftermath</dt><dd>{isAttacker ? 'The target province was destroyed.' : 'Your province was destroyed.'}</dd></div>
        )}
      </dl>
      {!compact && isAttacker && report.units.length > 0 && (
        <table className="battle-units">
          <thead>
            <tr><th>Unit</th><th>Sent</th><th>Lost</th><th>Returning</th></tr>
          </thead>
          <tbody>
            {report.units.map(unit => (
              <tr key={unit.name}>
                <td>{unit.name}</td>
                <td>{number(unit.sent)}</td>
                <td>{number(unit.lost)}</td>
                <td>{number(Math.max(0, unit.sent - unit.lost))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
