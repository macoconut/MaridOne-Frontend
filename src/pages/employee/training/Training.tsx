import { useEffect, useMemo, useState } from 'react';
import { FiChevronDown, FiFileText } from 'react-icons/fi';
import { apiFetchJson, toArray } from '../../../lib/api';
import './Training.css';

type MaterialSection = {
  id: string;
  title: string;
  items: string[];
};

export default function Training() {
  const [sections, setSections] = useState<MaterialSection[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    onboarding: true,
    training: true,
  });

  useEffect(() => {
    void (async () => {
      try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const [notificationsResponse, eventsResponse] = await Promise.all([
          apiFetchJson<unknown>('/api/notifications?page=0&size=20'),
          apiFetchJson<unknown>(`/api/calendar/events?month=${month}&year=${year}`),
        ]);

        const notificationItems = toArray<Record<string, unknown>>(
          notificationsResponse
        )
          .map((row) => String(row.message ?? '').trim())
          .filter((msg) => msg.length > 0);

        const eventItems = toArray<Record<string, unknown>>(eventsResponse)
          .map((row) => String(row.title ?? '').trim())
          .filter((title) => title.length > 0)
          .map((title) => `Upcoming event: ${title}`);

        const grouped: MaterialSection[] = [
          {
            id: 'training',
            title: 'Training Updates',
            items:
              notificationItems.length > 0
                ? notificationItems.slice(0, 8)
                : ['No training updates yet.'],
          },
          {
            id: 'onboarding',
            title: 'Onboarding & Company Events',
            items: eventItems.length > 0 ? eventItems.slice(0, 8) : ['No onboarding events this month.'],
          },
        ];
        setSections(grouped);
      } catch {
        setSections([
          {
            id: 'training',
            title: 'Training Updates',
            items: ['Cannot load training materials from backend yet.'],
          },
          {
            id: 'onboarding',
            title: 'Onboarding & Company Events',
            items: ['Cannot load onboarding events from backend yet.'],
          },
        ]);
      }
    })();
  }, []);

  const isEmpty = useMemo(
    () => sections.length === 0 || sections.every((section) => section.items.length === 0),
    [sections]
  );

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="trainingPage">
      <div className="trainingPage__head">
        <h1 className="trainingPage__title">Training Materials</h1>
      </div>

      <div className="trainingPage__stack">
        {!isEmpty ? (
          sections.map((section) => {
            const isOpen = !!openSections[section.id];
            return (
              <section key={section.id} className="tmCard">
                <button
                  type="button"
                  className="tmCard__header"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isOpen}
                  aria-controls={`tm-content-${section.id}`}
                >
                  <span className="tmCard__title">{section.title}</span>
                  <span className={`tmCard__chevron ${isOpen ? 'is-open' : ''}`}>
                    <FiChevronDown />
                  </span>
                </button>

                {isOpen && (
                  <div id={`tm-content-${section.id}`} className="tmCard__content">
                    {section.items.map((item) => (
                      <button key={item} type="button" className="tmRow">
                        <FiFileText className="tmRow__icon" />
                        <span className="tmRow__label">{item}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        ) : (
          <section className="tmCard">
            <div className="tmCard__header">
              <span className="tmCard__title">No training materials yet.</span>
            </div>
            <div className="tmCard__content">
              <div className="tmRow">
                <FiFileText className="tmRow__icon" />
                <span className="tmRow__label">Waiting for backend data.</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
