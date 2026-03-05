import { useState, useMemo, useCallback } from 'react';

interface PaginationResult<T> {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  pagedItems: T[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  resetPage: () => void;
}

export function usePagination<T>(items: T[], initialPageSize = 10): PaginationResult<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp page when items or pageSize changes
  const clampedPage = Math.min(page, totalPages);

  const pagedItems = useMemo(
    () => items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [items, clampedPage, pageSize]
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPage(1);
  }, []);

  const nextPage = useCallback(() => {
    setPage(p => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage(p => Math.max(1, p - 1));
  }, []);

  const resetPage = useCallback(() => setPage(1), []);

  return {
    page: clampedPage,
    pageSize,
    totalPages,
    totalItems,
    pagedItems,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    resetPage,
  };
}
