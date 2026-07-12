import '@testing-library/jest-dom';
import * as React from 'react';
import { vi } from 'vitest';

// Define props type for components wrapped withTranslation HOC
type WrappedComponentProps = {
    t?: (key: string) => string
    [key: string]: unknown
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            changeLanguage: () => new Promise(() => {
            }),
            language: 'de',
        },
        ready: true,
    }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
    initReactI18next: {
        type: '3rdParty',
        init: () => {
        },
    },
    withTranslation: () => (Component: React.ComponentType<WrappedComponentProps>) => (
        props: WrappedComponentProps
    ) => React.createElement(Component, { t: (key: string) => key, ...props }),
}));