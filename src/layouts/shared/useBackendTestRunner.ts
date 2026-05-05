import { useCallback, useState } from 'react';
import { apiFetchRaw, getApiBaseUrl } from '../../lib/api/api';
import {
  applyBodyPlaceholders,
  applyPathPlaceholders,
  type PlaceholderContext,
} from '@/lib/test/backendTest';

export type BackendTestAction = {
  label: string;
  description?: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
};

type UseBackendTestRunnerOptions = {
  initialAction?: string;
  initialResult?: string;
};

export function useBackendTestRunner(
  buildContext: () => Promise<PlaceholderContext>,
  options: UseBackendTestRunnerOptions = {}
) {
  const { initialAction = 'None', initialResult = '' } = options;
  const [backendAction, setBackendAction] = useState(initialAction);
  const [backendResult, setBackendResult] = useState(initialResult);
  const [isLoading, setIsLoading] = useState(false);

  const handleBackendTest = useCallback(
    async (action: BackendTestAction) => {
      const context = await buildContext();

      let pathResolved = applyPathPlaceholders(action.path, context);
      let bodyResolved = applyBodyPlaceholders(action.body, context);
      const missing = new Set([...pathResolved.missing, ...bodyResolved.missing]);

      for (const key of missing) {
        const entered = window.prompt(`Enter value for ${key}:`);
        if (!entered || entered.trim().length === 0) {
          setBackendResult(`Cancelled: missing required value "${key}".`);
          return;
        }
        context[key] = entered.trim();
      }

      pathResolved = applyPathPlaceholders(action.path, context);
      bodyResolved = applyBodyPlaceholders(action.body, context);
      const resolvedPath = pathResolved.value;
      const requestLabel = `${action.method} ${resolvedPath}`;

      setBackendAction(requestLabel);
      setIsLoading(true);
      setBackendResult(`Sending ${requestLabel} ...`);

      try {
        const headers: Record<string, string> = {};
        if (bodyResolved.value !== undefined) {
          headers['Content-Type'] = 'application/json';
        }

        const response = await apiFetchRaw(resolvedPath, {
          method: action.method,
          headers,
          body: bodyResolved.value !== undefined ? JSON.stringify(bodyResolved.value) : undefined,
        });

        const raw = await response.text();
        let formatted = raw;

        try {
          formatted = JSON.stringify(JSON.parse(raw), null, 2);
        } catch {
          if (raw.trim().length === 0) {
            formatted = '(no response body)';
          }
        }

        setBackendResult(
          [
            `URL: ${getApiBaseUrl()}${resolvedPath}`,
            `Status: ${response.status} ${response.statusText}`,
            '',
            formatted,
          ].join('\n')
        );
      } catch (error) {
        setBackendResult(
          [
            `URL: ${getApiBaseUrl()}${resolvedPath}`,
            'Request failed before reaching backend.',
            String(error),
          ].join('\n')
        );
      } finally {
        setIsLoading(false);
      }
    },
    [buildContext]
  );

  return {
    backendAction,
    backendResult,
    handleBackendTest,
    isLoading,
  };
}
