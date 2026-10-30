import { useCallback } from 'react';

interface UseCalendarNavigationProps {
  currentDate: Date;
  setCurrentDate: (date: Date | ((prev: Date) => Date)) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  focusedDate: Date;
  setFocusedDate: (date: Date) => void;
}

export const useCalendarNavigation = ({
  setCurrentDate,
  selectedDate,
  setSelectedDate,
  setFocusedDate,
}: UseCalendarNavigationProps) => {
  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  }, [setCurrentDate]);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  }, [setCurrentDate]);

  const goToPreviousWeek = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  }, [setCurrentDate]);

  const goToNextWeek = useCallback(() => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  }, [setCurrentDate]);

  const goToPreviousDay = useCallback(() => {
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    setSelectedDate(prevDay);
    setFocusedDate(prevDay);
    setCurrentDate(prevDay);
  }, [selectedDate, setSelectedDate, setFocusedDate, setCurrentDate]);

  const goToNextDay = useCallback(() => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay);
    setFocusedDate(nextDay);
    setCurrentDate(nextDay);
  }, [selectedDate, setSelectedDate, setFocusedDate, setCurrentDate]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setSelectedDate(today);
    setFocusedDate(today);
    setCurrentDate(today);
  }, [setSelectedDate, setFocusedDate, setCurrentDate]);

  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setFocusedDate(date);
  }, [setSelectedDate, setFocusedDate]);

  return {
    goToPreviousMonth,
    goToNextMonth,
    goToPreviousWeek,
    goToNextWeek,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    handleDateClick,
  };
};