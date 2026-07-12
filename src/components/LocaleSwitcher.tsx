import {type ChangeEvent, useState, useTransition} from "react";
import i18next from "i18next";

export default function LocaleSwitcher() {
    const [language, setLanguage] = useState(i18next.language);
    const [isPending, startTransition] = useTransition();

    const languages = [
        {code: 'en', name: 'English'},
        {code: 'de', name: 'Deutsch'},
    ];

    function onSelectChange(event: ChangeEvent<HTMLSelectElement>) {
        const selectedLanguage = event.target.value;
        startTransition(async () => {
            setLanguage(selectedLanguage);
            await i18next.changeLanguage(selectedLanguage);
        });
    }


    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} fill="none"/>
                    <path d="M2 12h20" stroke="currentColor" strokeWidth={2} fill="none"/>
                    <ellipse cx="12" cy="12" rx="6" ry="10" stroke="currentColor" strokeWidth={2} fill="none"/>
                    <ellipse cx="12" cy="12" rx="10" ry="6" stroke="currentColor" strokeWidth={2} fill="none"/>
                </svg>
            </div>
            <select
                onChange={onSelectChange}
                disabled={isPending}
                defaultValue={language}
                className="appearance-none w-full pl-10 pr-10 py-3 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
                {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                        {lang.name}
                    </option>
                ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
            </div>
        </div>
    );
}