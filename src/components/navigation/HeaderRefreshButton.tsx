import { FiRefreshCw } from 'react-icons/fi';
import { usePageRefresh } from '@/lib/utils/usePageRefresh';

export default function HeaderRefreshButton() {
  const { isRefreshing, refreshPage } = usePageRefresh();
  const refreshLabel = isRefreshing ? 'Refreshing current page' : 'Refresh current page';

  return (
    <button
      className="eTop__refresh"
      type="button"
      aria-label={refreshLabel}
      title={refreshLabel}
      onClick={() => void refreshPage()}
    >
      <FiRefreshCw className={isRefreshing ? 'is-spinning' : ''} />
    </button>
  );
}
