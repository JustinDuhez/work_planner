import {
  monthWeeks,
  type DayTypeView,
  type PlanningSection,
  type TeamMonth,
} from '@work-planner/domain';
import { Link } from 'react-router';
import { HalfCell } from '../calendar/month-card';
import { Gap } from '../clock/counters-card';
import { copy } from '../copy';

const monthTitle = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const weekdayInitial = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow', timeZone: 'UTC' });
const atNoon = (date: string) => new Date(`${date}T12:00:00Z`);

type Person = TeamMonth['people'][number];

function PersonRow({
  person,
  isManager,
  today,
  dates,
  dayTypes,
  holidayByDate,
}: {
  person: Person;
  isManager: boolean;
  today: string;
  dates: readonly string[];
  dayTypes: readonly DayTypeView[];
  holidayByDate: ReadonlyMap<string, string>;
}) {
  const halfByKey = new Map(
    person.halfDays.map((halfDay) => [`${halfDay.date}:${halfDay.half}`, halfDay]),
  );
  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 bg-white px-3 py-1 text-left font-normal whitespace-nowrap"
      >
        <Link
          to={`/calendrier/${person.id}`}
          className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-primary-600"
        >
          {`${person.firstName} ${person.lastName}`}
        </Link>
        {isManager ? (
          <span className="ml-2 rounded bg-zinc-100 px-1 text-xs text-zinc-600">
            {copy.planning.manager}
          </span>
        ) : null}
        <span className="ml-2 text-xs">
          <span className="sr-only">{copy.planning.balance} </span>
          <Gap
            minutes={person.balance.globalGapMinutes}
            isRefused={person.balance.hasOpenRefusal}
            className=""
          />
        </span>
      </th>
      {dates.map((date) => (
        <td key={date} className={`p-0.5 ${date === today ? 'bg-primary-50' : ''}`}>
          <div className="w-5 overflow-hidden rounded border border-zinc-200">
            {(['am', 'pm'] as const).map((half) => (
              <HalfCell
                key={half}
                date={date}
                half={half}
                declared={halfByKey.get(`${date}:${half}`)}
                holidayLabel={holidayByDate.get(date)}
                dayTypes={dayTypes}
                onClick={undefined}
              />
            ))}
          </div>
        </td>
      ))}
    </tr>
  );
}

export function TeamMonthTable({
  teamMonth,
  sections,
  dayTypes,
}: {
  teamMonth: TeamMonth;
  sections: readonly PlanningSection[];
  dayTypes: readonly DayTypeView[];
}) {
  const weeks = monthWeeks(teamMonth.month);
  const dates = weeks.flatMap((week) => week.dates);
  const personById = new Map(teamMonth.people.map((person) => [person.id, person]));
  const holidayByDate = new Map(teamMonth.holidays.map((holiday) => [holiday.date, holiday.label]));
  const title = `${copy.planning.tableLabelPrefix} ${monthTitle.format(atNoon(teamMonth.month.startDate))}`;
  return (
    <div className="overflow-x-auto rounded-card border border-zinc-200 bg-white">
      <table aria-label={title} className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th rowSpan={2} scope="col" className="sticky left-0 z-10 bg-white px-3 text-left">
              {copy.planning.person}
            </th>
            {weeks.map((week) => (
              <th
                key={week.isoWeek}
                colSpan={week.dates.length}
                scope="colgroup"
                className="border-l border-zinc-200 px-1 text-xs text-zinc-600"
              >
                {`${copy.planning.weekPrefix}${week.weekNumber}`}
              </th>
            ))}
          </tr>
          <tr>
            {dates.map((date) => (
              <th
                key={date}
                scope="col"
                aria-current={date === teamMonth.today ? 'date' : undefined}
                className={`w-6 px-0.5 text-[10px] font-normal text-zinc-600 ${date === teamMonth.today ? 'bg-primary-50 font-semibold text-primary-700' : ''}`}
              >
                <span aria-hidden>{weekdayInitial.format(atNoon(date))}</span>
                <span className="block">{Number(date.slice(8))}</span>
              </th>
            ))}
          </tr>
        </thead>
        {sections.map((section) => (
          <tbody key={section.teamId ?? 'none'}>
            <tr>
              <td
                colSpan={dates.length + 1}
                className="sticky left-0 bg-zinc-50 px-3 py-1 text-left text-xs font-semibold text-zinc-700"
              >
                {section.title}
              </td>
            </tr>
            {section.rows.flatMap((row) => {
              const person = personById.get(row.personId);
              return person
                ? [
                    <PersonRow
                      key={row.personId}
                      person={person}
                      isManager={row.isManager}
                      today={teamMonth.today}
                      dates={dates}
                      dayTypes={dayTypes}
                      holidayByDate={holidayByDate}
                    />,
                  ]
                : [];
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
