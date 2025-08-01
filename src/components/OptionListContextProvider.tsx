import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import type {OnyxCollection} from 'react-native-onyx';
import useOnyx from '@hooks/useOnyx';
import usePrevious from '@hooks/usePrevious';
import {createOptionFromReport, createOptionList, processReport, shallowOptionsListCompare} from '@libs/OptionsListUtils';
import type {OptionList, SearchOption} from '@libs/OptionsListUtils';
import {isSelfDM} from '@libs/ReportUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetails, Report} from '@src/types/onyx';
import {usePersonalDetails} from './OnyxListItemProvider';

type OptionsListContextProps = {
    /** List of options for reports and personal details */
    options: OptionList;
    /** Function to initialize the options */
    initializeOptions: () => void;
    /** Flag to check if the options are initialized */
    areOptionsInitialized: boolean;
    /** Function to reset the options */
    resetOptions: () => void;
};

type OptionsListProviderProps = {
    /** Actual content wrapped by this component */
    children: React.ReactNode;
};

const OptionsListContext = createContext<OptionsListContextProps>({
    options: {
        reports: [],
        personalDetails: [],
    },
    initializeOptions: () => {},
    areOptionsInitialized: false,
    resetOptions: () => {},
});

const isEqualPersonalDetail = (prevPersonalDetail: PersonalDetails, personalDetail: PersonalDetails) =>
    prevPersonalDetail?.firstName === personalDetail?.firstName &&
    prevPersonalDetail?.lastName === personalDetail?.lastName &&
    prevPersonalDetail?.login === personalDetail?.login &&
    prevPersonalDetail?.displayName === personalDetail?.displayName;

function OptionsListContextProvider({children}: OptionsListProviderProps) {
    const areOptionsInitialized = useRef(false);
    const [options, setOptions] = useState<OptionList>({
        reports: [],
        personalDetails: [],
    });
    const [reportAttributes] = useOnyx(ONYXKEYS.DERIVED.REPORT_ATTRIBUTES, {canBeMissing: true});
    const prevReportAttributesLocale = usePrevious(reportAttributes?.locale);
    const [reports, {sourceValue: changedReports}] = useOnyx(ONYXKEYS.COLLECTION.REPORT, {canBeMissing: true});
    const [, {sourceValue: changedReportActions}] = useOnyx(ONYXKEYS.COLLECTION.REPORT_ACTIONS, {canBeMissing: true});
    const personalDetails = usePersonalDetails();
    const prevPersonalDetails = usePrevious(personalDetails);
    const hasInitialData = useMemo(() => Object.keys(personalDetails ?? {}).length > 0, [personalDetails]);

    const loadOptions = useCallback(() => {
        const optionLists = createOptionList(personalDetails, reports, reportAttributes?.reports);
        setOptions({
            reports: optionLists.reports,
            personalDetails: optionLists.personalDetails,
        });
    }, [personalDetails, reports, reportAttributes?.reports]);

    /**
     * This effect is responsible for generating the options list when their data is not yet initialized
     */
    useEffect(() => {
        if (!areOptionsInitialized.current || !reports || hasInitialData) {
            return;
        }

        loadOptions();
    }, [reports, personalDetails, hasInitialData, loadOptions]);

    /**
     * This effect is responsible for generating the options list when the locale changes
     * Since options might use report attributes, it's necessary to call this after report attributes are loaded with the new locale to make sure the options are generated in a proper language
     */
    useEffect(() => {
        if (reportAttributes?.locale === prevReportAttributesLocale) {
            return;
        }

        loadOptions();
    }, [prevReportAttributesLocale, loadOptions, reportAttributes?.locale]);

    const changedReportsEntries = useMemo(() => {
        const result: OnyxCollection<Report> = {};

        Object.keys(changedReports ?? {}).forEach((key) => {
            const report = reports?.[key];
            if (report) {
                result[key] = report;
            }
        });
        return result;
    }, [changedReports, reports]);

    /**
     * This effect is responsible for updating the options only for changed reports
     */
    useEffect(() => {
        if (!changedReportsEntries || !areOptionsInitialized.current) {
            return;
        }

        setOptions((prevOptions) => {
            const changedReportKeys = Object.keys(changedReportsEntries);
            if (changedReportKeys.length === 0) {
                return prevOptions;
            }

            const updatedReportsMap = new Map(prevOptions.reports.map((report) => [report.reportID, report]));
            changedReportKeys.forEach((reportKey) => {
                const report = changedReportsEntries[reportKey];
                const reportID = reportKey.replace(ONYXKEYS.COLLECTION.REPORT, '');
                const {reportOption} = processReport(report, personalDetails, reportAttributes?.reports);

                if (reportOption) {
                    updatedReportsMap.set(reportID, reportOption);
                } else {
                    updatedReportsMap.delete(reportID);
                }
            });

            return {
                ...prevOptions,
                reports: Array.from(updatedReportsMap.values()),
            };
        });
    }, [changedReportsEntries, personalDetails, reportAttributes?.reports]);

    useEffect(() => {
        if (!changedReportActions || !areOptionsInitialized.current) {
            return;
        }

        setOptions((prevOptions) => {
            const changedReportActionsEntries = Object.entries(changedReportActions);
            if (changedReportActionsEntries.length === 0) {
                return prevOptions;
            }

            const updatedReportsMap = new Map(prevOptions.reports.map((report) => [report.reportID, report]));
            changedReportActionsEntries.forEach(([key, reportAction]) => {
                if (!reportAction) {
                    return;
                }

                const reportID = key.replace(ONYXKEYS.COLLECTION.REPORT_ACTIONS, '');
                const {reportOption} = processReport(updatedReportsMap.get(reportID)?.item, personalDetails, reportAttributes?.reports);

                if (reportOption) {
                    updatedReportsMap.set(reportID, reportOption);
                }
            });

            return {
                ...prevOptions,
                reports: Array.from(updatedReportsMap.values()),
            };
        });
    }, [changedReportActions, personalDetails, reportAttributes?.reports]);

    /**
     * This effect is used to update the options list when personal details change.
     */
    useEffect(() => {
        // there is no need to update the options if the options are not initialized
        if (!areOptionsInitialized.current) {
            return;
        }

        if (!personalDetails) {
            return;
        }

        // Handle initial personal details load. This initialization is required here specifically to prevent
        // UI freezing that occurs when resetting the app from the troubleshooting page.
        if (!prevPersonalDetails) {
            const {personalDetails: newPersonalDetailsOptions, reports: newReports} = createOptionList(personalDetails, reports, reportAttributes?.reports);
            setOptions((prevOptions) => ({
                ...prevOptions,
                personalDetails: newPersonalDetailsOptions,
                reports: newReports,
            }));
            return;
        }

        const newReportOptions: Array<{
            replaceIndex: number;
            newReportOption: SearchOption<Report>;
        }> = [];

        Object.keys(personalDetails).forEach((accountID) => {
            const prevPersonalDetail = prevPersonalDetails?.[accountID];
            const personalDetail = personalDetails[accountID];

            if (prevPersonalDetail && personalDetail && isEqualPersonalDetail(prevPersonalDetail, personalDetail)) {
                return;
            }

            Object.values(reports ?? {})
                .filter((report) => !!Object.keys(report?.participants ?? {}).includes(accountID) || (isSelfDM(report) && report?.ownerAccountID === Number(accountID)))
                .forEach((report) => {
                    if (!report) {
                        return;
                    }
                    const newReportOption = createOptionFromReport(report, personalDetails, reportAttributes?.reports);
                    const replaceIndex = options.reports.findIndex((option) => option.reportID === report.reportID);
                    newReportOptions.push({
                        newReportOption,
                        replaceIndex,
                    });
                });
        });

        // since personal details are not a collection, we need to recreate the whole list from scratch
        const newPersonalDetailsOptions = createOptionList(personalDetails, reports, reportAttributes?.reports).personalDetails;

        setOptions((prevOptions) => {
            const newOptions = {...prevOptions};
            newOptions.personalDetails = newPersonalDetailsOptions;
            newReportOptions.forEach((newReportOption) => (newOptions.reports[newReportOption.replaceIndex] = newReportOption.newReportOption));
            return newOptions;
        });

        // This effect is used to update the options list when personal details change so we ignore all dependencies except personalDetails
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, [personalDetails, reportAttributes?.reports]);

    const initializeOptions = useCallback(() => {
        loadOptions();
        areOptionsInitialized.current = true;
    }, [loadOptions]);

    const resetOptions = useCallback(() => {
        if (!areOptionsInitialized.current) {
            return;
        }

        areOptionsInitialized.current = false;
        setOptions({
            reports: [],
            personalDetails: [],
        });
    }, []);

    return (
        <OptionsListContext.Provider // eslint-disable-next-line react-compiler/react-compiler
            value={useMemo(() => ({options, initializeOptions, areOptionsInitialized: areOptionsInitialized.current, resetOptions}), [options, initializeOptions, resetOptions])}
        >
            {children}
        </OptionsListContext.Provider>
    );
}

const useOptionsListContext = () => useContext(OptionsListContext);

// Hook to use the OptionsListContext with an initializer to load the options
const useOptionsList = (options?: {shouldInitialize: boolean}) => {
    const {shouldInitialize = true} = options ?? {};
    const {initializeOptions, options: optionsList, areOptionsInitialized, resetOptions} = useOptionsListContext();
    const [internalOptions, setInternalOptions] = useState<OptionList>(optionsList);
    const prevOptions = useRef<OptionList>(null);

    useEffect(() => {
        if (!prevOptions.current) {
            prevOptions.current = optionsList;
            setInternalOptions(optionsList);
            return;
        }
        /**
         * optionsList reference can change multiple times even the value of its arrays is the same. We perform shallow comparison to check if the options have truly changed.
         * This is necessary to avoid unnecessary re-renders in components that use this context.
         */
        const areOptionsEqual = shallowOptionsListCompare(prevOptions.current, optionsList);
        prevOptions.current = optionsList;
        if (areOptionsEqual) {
            return;
        }
        setInternalOptions(optionsList);
    }, [optionsList]);

    useEffect(() => {
        if (!shouldInitialize || areOptionsInitialized) {
            return;
        }

        initializeOptions();
    }, [shouldInitialize, initializeOptions, areOptionsInitialized]);

    return useMemo(
        () => ({
            initializeOptions,
            options: internalOptions,
            areOptionsInitialized,
            resetOptions,
        }),
        [initializeOptions, internalOptions, areOptionsInitialized, resetOptions],
    );
};

export default OptionsListContextProvider;

export {useOptionsList, OptionsListContext};
