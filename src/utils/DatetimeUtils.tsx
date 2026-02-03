import { format, parseISO, differenceInDays } from 'date-fns';

export function convertToDesiredFormat(datetimeString: string) {
    const parsedDate = parseISO(datetimeString);
    return format(parsedDate, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

type GetPrettyTimePubProps = {
    date: Date;
};

export const GetPrettyTimePub = ({ date }: GetPrettyTimePubProps): string => {
    const now: Date = new Date();

    const days = differenceInDays(new Date(now.getFullYear(), now.getMonth(),now.getDate()),
        new Date(date.getFullYear(), date.getMonth(),date.getDate()));
    switch (days) {
        case 0:
            return "сегодня";
        case 1:
            return "вчера";
        case 2:
            return "2 дня назад";
        case 3:
            return "3 дня назад";
        case 4:
            return "4 дня назад";
        case 5:
            return "5 дней назад";
        case 6:
            return "6 дней назад";
        case 7:
            return "неделю назад";
        default:
            // Format the date as DD.MM.YYYY for older dates
            return `${date.getDate() < 10 ? "0" : ""}${date.getDate()}.${
                date.getMonth() + 1 < 10 ? "0" : ""
            }${date.getMonth() + 1}.${date.getFullYear()}`;
    }
};
