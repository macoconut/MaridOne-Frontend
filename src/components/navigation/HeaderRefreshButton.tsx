import { FiRefreshCw } from 'react-icons/fi';
import { usePageRefresh } from '../../lib/pageRefresh';

export default function HeaderRefreshButton() {
  const { isRefreshing, refreshPage } = usePageRefresh();

  return (
    <button
      className="eTop__refresh"
      type="button"
      aria-label="Refresh current page"
      onClick={() => void refreshPage()}
    >
      <FiRefreshCw className={isRefreshing ? 'is-spinning' : ''} />
      <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
    </button>
  );
}
