export const calculateInspectionQuantity = (bookQuantity: number, increaseQuantity: number, decreaseQuantity: number) =>
    bookQuantity + increaseQuantity - decreaseQuantity;

export const calculateQuantityDifference = (bookQuantity: number, inspectionQuantity: number) =>
    bookQuantity - inspectionQuantity;

export const getPreviousReportMonth = (month: number, year: number) => {
    const previous = new Date(year, month - 2, 1);
    const previousMonth = previous.getMonth() + 1;
    return {
        month: previousMonth,
        year: previous.getFullYear(),
        label: String(previousMonth).padStart(2, '0'),
    };
};
