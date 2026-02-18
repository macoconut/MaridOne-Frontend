import { useState } from 'react';
import { FiChevronDown, FiFileText } from 'react-icons/fi';
import './Training.css';

type MaterialSection = {
  id: string;
  title: string;
  items: string[];
};

const sections: MaterialSection[] = [
  {
    id: 'onboarding',
    title: 'Employee Onboarding Materials',
    items: [
      'Viewing Payslips Manual',
      'Filing Leave and OT Requests Manual',
      'Updating Personal Information Manual',
      'Dashboard Walkthrough',
      '<add more if needed>',
    ],
  },
  {
    id: 'training',
    title: 'Employee Training Materials',
    items: [
      'Easy Ways to Ease Personal Workflow',
      'How to Manage Orders?',
      '5 Methods of Managing Orders',
      '10 Tips from Managers',
      '<add more if needed>',
    ],
  },
];

export default function Training() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    onboarding: true,
    training: true,
  });

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="trainingPage">
      <div className="trainingPage__head">
        <h1 className="trainingPage__title">Training Materials</h1>
      </div>

      <div className="trainingPage__stack">
        {sections.map((section) => {
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
        })}
      </div>
    </div>
  );
}
