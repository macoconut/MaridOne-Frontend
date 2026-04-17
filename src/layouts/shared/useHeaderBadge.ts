import { useEffect, useState } from 'react';
import { resolveHeaderBadgeParts } from '../../lib/headerProfile';
import { getUserEmail } from '../../lib/session';

export function useHeaderBadge(roleLabel: string) {
  const [headerBadge, setHeaderBadge] = useState(roleLabel);
  const [headerDepartment, setHeaderDepartment] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadHeaderBadge() {
      try {
        const badgeParts = await resolveHeaderBadgeParts(getUserEmail(), roleLabel);
        if (cancelled) return;

        setHeaderBadge(badgeParts.badgeLabel);
        setHeaderDepartment(badgeParts.departmentLabel);
      } catch {
        if (cancelled) return;

        setHeaderBadge(roleLabel);
        setHeaderDepartment('');
      }
    }

    void loadHeaderBadge();

    return () => {
      cancelled = true;
    };
  }, [roleLabel]);

  return {
    headerBadge,
    headerDepartment,
  };
}
