import {format} from 'date-fns';
import {Str} from 'expensify-common';
import {deepEqual} from 'fast-equals';
import React, {memo, useMemo} from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import usePrevious from '@hooks/usePrevious';
import useThemeStyles from '@hooks/useThemeStyles';
import {convertToDisplayString} from '@libs/CurrencyUtils';
import DistanceRequestUtils from '@libs/DistanceRequestUtils';
import Navigation from '@libs/Navigation/Navigation';
import {getDestinationForDisplay, getSubratesFields, getSubratesForDisplay, getTimeDifferenceIntervals, getTimeForDisplay} from '@libs/PerDiemRequestUtils';
import {canSendInvoice, getPerDiemCustomUnit, isPaidGroupPolicy} from '@libs/PolicyUtils';
import type {ThumbnailAndImageURI} from '@libs/ReceiptUtils';
import {getThumbnailAndImageURIs} from '@libs/ReceiptUtils';
import {
    buildOptimisticExpenseReport,
    getDefaultWorkspaceAvatar,
    getOutstandingReportsForUser,
    isMoneyRequestReport,
    isReportOutstanding,
    populateOptimisticReportFormula,
} from '@libs/ReportUtils';
import {getTagVisibility, hasEnabledTags} from '@libs/TagsOptionsListUtils';
import {
    getTagForDisplay,
    getTaxAmount,
    getTaxName,
    isAmountMissing,
    isCreatedMissing,
    isFetchingWaypointsFromServer,
    shouldShowAttendees as shouldShowAttendeesTransactionUtils,
} from '@libs/TransactionUtils';
import tryResolveUrlFromApiRoot from '@libs/tryResolveUrlFromApiRoot';
import ToggleSettingOptionRow from '@pages/workspace/workflows/ToggleSettingsOptionRow';
import CONST from '@src/CONST';
import type {IOUAction, IOUType} from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type * as OnyxTypes from '@src/types/onyx';
import type {Attendee, Participant} from '@src/types/onyx/IOU';
import type {Unit} from '@src/types/onyx/Policy';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import Badge from './Badge';
import ConfirmedRoute from './ConfirmedRoute';
import MentionReportContext from './HTMLEngineProvider/HTMLRenderers/MentionReportRenderer/MentionReportContext';
import * as Expensicons from './Icon/Expensicons';
import MenuItem from './MenuItem';
import MenuItemWithTopDescription from './MenuItemWithTopDescription';
import PDFThumbnail from './PDFThumbnail';
import PressableWithoutFocus from './Pressable/PressableWithoutFocus';
import ReceiptEmptyState from './ReceiptEmptyState';
import ReceiptImage from './ReceiptImage';
import {ShowContextMenuContext} from './ShowContextMenuContext';

type MoneyRequestConfirmationListFooterProps = {
    /** The action to perform */
    action: IOUAction;

    /** The currency of the transaction */
    currency: string;

    /** Flag indicating if the confirmation is done */
    didConfirm: boolean;

    /** The distance of the transaction */
    distance: number;

    /** The formatted amount of the transaction */
    formattedAmount: string;

    /** The formatted amount of the transaction per 1 attendee */
    formattedAmountPerAttendee: string;

    /** The error message for the form */
    formError: string;

    /** Flag indicating if there is a route */
    hasRoute: boolean;

    /** The category of the IOU */
    iouCategory: string;

    /** The list of attendees */
    iouAttendees: Attendee[] | undefined;

    /** The comment of the IOU */
    iouComment: string | undefined;

    /** The creation date of the IOU */
    iouCreated: string | undefined;

    /** The currency code of the IOU */
    iouCurrencyCode: string | undefined;

    /** Flag indicating if the IOU is billable */
    iouIsBillable: boolean;

    /** The merchant of the IOU */
    iouMerchant: string | undefined;

    /** The type of the IOU */
    iouType: Exclude<IOUType, typeof CONST.IOU.TYPE.REQUEST | typeof CONST.IOU.TYPE.SEND>;

    /** Flag indicating if the category is required */
    isCategoryRequired: boolean;

    /** Flag indicating if it is a distance request */
    isDistanceRequest: boolean;

    /** Flag indicating if it is a per diem request */
    isPerDiemRequest: boolean;

    /** Flag indicating if the merchant is empty */
    isMerchantEmpty: boolean;

    /** Flag indicating if the merchant is required */
    isMerchantRequired: boolean | undefined;

    /** Flag indicating if it is a policy expense chat */
    isPolicyExpenseChat: boolean;

    /** Flag indicating if it is read-only */
    isReadOnly: boolean;

    /** Flag indicating if it is an invoice type */
    isTypeInvoice: boolean;

    /** Function to toggle billable */
    onToggleBillable?: (isOn: boolean) => void;

    /** The policy */
    policy: OnyxEntry<OnyxTypes.Policy>;

    /** The policy tag lists */
    policyTags: OnyxEntry<OnyxTypes.PolicyTagLists>;

    /** The policy tag lists */
    policyTagLists: Array<ValueOf<OnyxTypes.PolicyTagLists>>;

    /** The rate of the transaction */
    rate: number | undefined;

    /** The filename of the receipt */
    receiptFilename: string;

    /** The path of the receipt */
    receiptPath: string;

    /** The report action ID */
    reportActionID: string | undefined;

    /** The report ID */
    reportID: string;

    /** The selected participants */
    selectedParticipants: Participant[];

    /** Flag indicating if the field error should be displayed */
    shouldDisplayFieldError: boolean;

    /** Flag indicating if the receipt should be displayed */
    shouldDisplayReceipt: boolean;

    /** Flag indicating if the categories should be shown */
    shouldShowCategories: boolean;

    /** Flag indicating if the merchant should be shown */
    shouldShowMerchant: boolean;

    /** Flag indicating if the smart scan fields should be shown */
    shouldShowSmartScanFields: boolean;

    /** Flag indicating if the amount field should be shown */
    shouldShowAmountField?: boolean;

    /** Flag indicating if the tax should be shown */
    shouldShowTax: boolean;

    /** The transaction */
    transaction: OnyxEntry<OnyxTypes.Transaction>;

    /** The transaction ID */
    transactionID: string | undefined;

    /** Whether the receipt can be replaced */
    isReceiptEditable?: boolean;

    /** The unit */
    unit: Unit | undefined;

    /** The PDF load error callback */
    onPDFLoadError?: () => void;

    /** The PDF password callback */
    onPDFPassword?: () => void;
};

function MoneyRequestConfirmationListFooter({
    action,
    currency,
    didConfirm,
    distance,
    formattedAmount,
    formattedAmountPerAttendee,
    formError,
    hasRoute,
    iouAttendees,
    iouCategory,
    iouComment,
    iouCreated,
    iouCurrencyCode,
    iouIsBillable,
    iouMerchant,
    iouType,
    isCategoryRequired,
    isDistanceRequest,
    isPerDiemRequest,
    isMerchantEmpty,
    isMerchantRequired,
    isPolicyExpenseChat,
    isReadOnly,
    isTypeInvoice,
    onToggleBillable,
    policy,
    policyTags,
    policyTagLists,
    rate,
    receiptFilename,
    receiptPath,
    reportActionID,
    reportID,
    selectedParticipants,
    shouldDisplayFieldError,
    shouldDisplayReceipt,
    shouldShowCategories,
    shouldShowMerchant,
    shouldShowSmartScanFields,
    shouldShowAmountField = true,
    shouldShowTax,
    transaction,
    transactionID,
    unit,
    onPDFLoadError,
    onPDFPassword,
    isReceiptEditable = false,
}: MoneyRequestConfirmationListFooterProps) {
    const styles = useThemeStyles();
    const {translate, toLocaleDigit} = useLocalize();
    const {isOffline} = useNetwork();
    const [allPolicies] = useOnyx(ONYXKEYS.COLLECTION.POLICY, {canBeMissing: true});
    const [allReports] = useOnyx(ONYXKEYS.COLLECTION.REPORT, {canBeMissing: true});

    const [currentUserLogin] = useOnyx(ONYXKEYS.SESSION, {selector: (session) => session?.email, canBeMissing: true});

    const shouldShowTags = useMemo(() => isPolicyExpenseChat && hasEnabledTags(policyTagLists), [isPolicyExpenseChat, policyTagLists]);
    const shouldShowAttendees = useMemo(() => shouldShowAttendeesTransactionUtils(iouType, policy), [iouType, policy]);

    const hasPendingWaypoints = transaction && isFetchingWaypointsFromServer(transaction);
    const hasErrors = !isEmptyObject(transaction?.errors) || !isEmptyObject(transaction?.errorFields?.route) || !isEmptyObject(transaction?.errorFields?.waypoints);
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const shouldShowMap = isDistanceRequest && !!(hasErrors || hasPendingWaypoints || iouType !== CONST.IOU.TYPE.SPLIT || !isReadOnly);

    const senderWorkspace = useMemo(() => {
        const senderWorkspaceParticipant = selectedParticipants.find((participant) => participant.isSender);
        return allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${senderWorkspaceParticipant?.policyID}`];
    }, [allPolicies, selectedParticipants]);

    const canUpdateSenderWorkspace = useMemo(() => {
        const isInvoiceRoomParticipant = selectedParticipants.some((participant) => participant.isInvoiceRoom);

        return canSendInvoice(allPolicies, currentUserLogin) && !!transaction?.isFromGlobalCreate && !isInvoiceRoomParticipant;
    }, [allPolicies, currentUserLogin, selectedParticipants, transaction?.isFromGlobalCreate]);

    /**
     * We need to check if the transaction report exists first in order to prevent the outstanding reports from being used.
     * Also we need to check if transaction report exists in outstanding reports in order to show a correct report name.
     */
    const transactionReport = !!transaction?.reportID && Object.values(allReports ?? {}).find((report) => report?.reportID === transaction.reportID);
    const policyID = selectedParticipants?.at(0)?.policyID;
    const reportOwnerAccountID = selectedParticipants?.at(0)?.ownerAccountID;
    const shouldUseTransactionReport = !!transactionReport && isReportOutstanding(transactionReport, policyID);
    const firstOutstandingReport = getOutstandingReportsForUser(policyID, reportOwnerAccountID, allReports ?? {}).at(0);
    let reportName: string | undefined;
    if (shouldUseTransactionReport) {
        reportName = transactionReport.reportName;
    } else {
        reportName = firstOutstandingReport?.reportName;
    }

    if (!reportName) {
        const optimisticReport = buildOptimisticExpenseReport(reportID, policy?.id, policy?.ownerAccountID ?? CONST.DEFAULT_NUMBER_ID, Number(formattedAmount), currency);
        reportName = populateOptimisticReportFormula(policy?.fieldList?.text_title?.defaultValue ?? '', optimisticReport, policy);
    }

    // When creating an expense in an individual report, the report field becomes read-only
    // since the destination is already determined and there's no need to show a selectable list.
    const shouldReportBeEditable = !!firstOutstandingReport && !isMoneyRequestReport(reportID, allReports);

    const isTypeSend = iouType === CONST.IOU.TYPE.PAY;
    const taxRates = policy?.taxRates ?? null;
    // In Send Money and Split Bill with Scan flow, we don't allow the Merchant or Date to be edited. For distance requests, don't show the merchant as there's already another "Distance" menu item
    const shouldShowDate = (shouldShowSmartScanFields || isDistanceRequest) && !isTypeSend;
    // Determines whether the tax fields can be modified.
    // The tax fields can only be modified if the component is not in read-only mode
    // and it is not a distance request.
    const canModifyTaxFields = !isReadOnly && !isDistanceRequest && !isPerDiemRequest;
    // A flag for showing the billable field
    const shouldShowBillable = policy?.disabledFields?.defaultBillable === false;
    // Calculate the formatted tax amount based on the transaction's tax amount and the IOU currency code
    const taxAmount = getTaxAmount(transaction, false);
    const formattedTaxAmount = convertToDisplayString(taxAmount, iouCurrencyCode);
    // Get the tax rate title based on the policy and transaction
    const taxRateTitle = getTaxName(policy, transaction);
    // Determine if the merchant error should be displayed
    const shouldDisplayMerchantError = isMerchantRequired && (shouldDisplayFieldError || formError === 'iou.error.invalidMerchant') && isMerchantEmpty;
    const shouldDisplayDistanceRateError = formError === 'iou.error.invalidRate';
    // The empty receipt component should only show for IOU Requests of a paid policy ("Team" or "Corporate")
    const shouldShowReceiptEmptyState = iouType === CONST.IOU.TYPE.SUBMIT && isPaidGroupPolicy(policy) && !isPerDiemRequest;
    // The per diem custom unit
    const perDiemCustomUnit = getPerDiemCustomUnit(policy);
    const {
        image: receiptImage,
        thumbnail: receiptThumbnail,
        isThumbnail,
        fileExtension,
        isLocalFile,
    } = receiptPath && receiptFilename ? getThumbnailAndImageURIs(transaction, receiptPath, receiptFilename) : ({} as ThumbnailAndImageURI);
    const resolvedThumbnail = isLocalFile ? receiptThumbnail : tryResolveUrlFromApiRoot(receiptThumbnail ?? '');
    const resolvedReceiptImage = isLocalFile ? receiptImage : tryResolveUrlFromApiRoot(receiptImage ?? '');

    const contextMenuContextValue = useMemo(
        () => ({
            anchor: null,
            report: undefined,
            isReportArchived: false,
            action: undefined,
            checkIfContextMenuActive: () => {},
            onShowContextMenu: () => {},
            isDisabled: true,
            shouldDisplayContextMenu: false,
        }),
        [],
    );

    const tagVisibility = useMemo(
        () =>
            getTagVisibility({
                shouldShowTags,
                policy,
                policyTags,
                transaction,
            }),
        [shouldShowTags, policy, policyTags, transaction],
    );

    const previousTagsVisibility = usePrevious(tagVisibility.map((v) => v.shouldShow)) ?? [];

    const mentionReportContextValue = useMemo(() => ({currentReportID: reportID, exactlyMatch: true}), [reportID]);

    const fields = [
        {
            item: (
                <MenuItemWithTopDescription
                    key={translate('iou.amount')}
                    shouldShowRightIcon={!isReadOnly && !isDistanceRequest}
                    title={formattedAmount}
                    description={translate('iou.amount')}
                    interactive={!isReadOnly}
                    onPress={() => {
                        if (isDistanceRequest || !transactionID) {
                            return;
                        }

                        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_AMOUNT.getRoute(action, iouType, transactionID, reportID, CONST.IOU.PAGE_INDEX.CONFIRM, Navigation.getActiveRoute()));
                    }}
                    style={[styles.moneyRequestMenuItem, styles.mt2]}
                    titleStyle={styles.moneyRequestConfirmationAmount}
                    disabled={didConfirm}
                    brickRoadIndicator={shouldDisplayFieldError && isAmountMissing(transaction) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
                    errorText={shouldDisplayFieldError && isAmountMissing(transaction) ? translate('common.error.enterAmount') : ''}
                />
            ),
            shouldShow: shouldShowSmartScanFields && shouldShowAmountField,
        },
        {
            item: (
                <View key={translate('common.description')}>
                    <ShowContextMenuContext.Provider value={contextMenuContextValue}>
                        <MentionReportContext.Provider value={mentionReportContextValue}>
                            <MenuItemWithTopDescription
                                shouldShowRightIcon={!isReadOnly}
                                shouldParseTitle
                                excludedMarkdownRules={!policy ? ['reportMentions'] : []}
                                title={iouComment}
                                description={translate('common.description')}
                                onPress={() => {
                                    if (!transactionID) {
                                        return;
                                    }

                                    Navigation.navigate(
                                        ROUTES.MONEY_REQUEST_STEP_DESCRIPTION.getRoute(action, iouType, transactionID, reportID, Navigation.getActiveRoute(), reportActionID),
                                    );
                                }}
                                style={[styles.moneyRequestMenuItem]}
                                titleStyle={styles.flex1}
                                disabled={didConfirm}
                                interactive={!isReadOnly}
                                numberOfLinesTitle={2}
                            />
                        </MentionReportContext.Provider>
                    </ShowContextMenuContext.Provider>
                </View>
            ),
            shouldShow: true,
        },
        {
            item: (
                <MenuItemWithTopDescription
                    key={translate('common.distance')}
                    shouldShowRightIcon={!isReadOnly}
                    title={DistanceRequestUtils.getDistanceForDisplay(hasRoute, distance, unit, rate, translate)}
                    description={translate('common.distance')}
                    style={[styles.moneyRequestMenuItem]}
                    titleStyle={styles.flex1}
                    onPress={() => {
                        if (!transactionID) {
                            return;
                        }

                        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_DISTANCE.getRoute(action, iouType, transactionID, reportID, Navigation.getActiveRoute()));
                    }}
                    disabled={didConfirm}
                    interactive={!isReadOnly}
                />
            ),
            shouldShow: isDistanceRequest,
        },
        {
            item: (
                <MenuItemWithTopDescription
                    key={translate('common.rate')}
                    shouldShowRightIcon={!!rate && !isReadOnly && isPolicyExpenseChat}
                    title={DistanceRequestUtils.getRateForDisplay(unit, rate, currency, translate, toLocaleDigit, isOffline)}
                    description={translate('common.rate')}
                    style={[styles.moneyRequestMenuItem]}
                    titleStyle={styles.flex1}
                    onPress={() => {
                        if (!transactionID) {
                            return;
                        }

                        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_DISTANCE_RATE.getRoute(action, iouType, transactionID, reportID, Navigation.getActiveRoute()));
                    }}
                    brickRoadIndicator={shouldDisplayDistanceRateError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
                    disabled={didConfirm}
                    interactive={!!rate && !isReadOnly && isPolicyExpenseChat}
                />
            ),
            shouldShow: isDistanceRequest,
        },
        {
            item: (
                <MenuItemWithTopDescription
                    key={translate('common.merchant')}
                    shouldShowRightIcon={!isReadOnly}
                    title={isMerchantEmpty ? '' : iouMerchant}
                    description={translate('common.merchant')}
                    style={[styles.moneyRequestMenuItem]}
                    titleStyle={styles.flex1}
                    onPress={() => {
                        if (!transactionID) {
                            return;
                        }

                        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_MERCHANT.getRoute(action, iouType, transactionID, reportID, Navigation.getActiveRoute()));
                    }}
                    disabled={didConfirm}
                    interactive={!isReadOnly}
                    brickRoadIndicator={shouldDisplayMerchantError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
                    errorText={shouldDisplayMerchantError ? translate('common.error.fieldRequired') : ''}
                    rightLabel={isMerchantRequired && !shouldDisplayMerchantError ? translate('common.required') : ''}
                    numberOfLinesTitle={2}
                />
            ),
            shouldShow: shouldShowMerchant,
        },
        {
            item: (
                <MenuItemWithTopDescription
                    key={translate('common.category')}
                    shouldShowRightIcon={!isReadOnly}
                    title={iouCategory}
                    description={translate('common.category')}
                    numberOfLinesTitle={2}
                    onPress={() => {
                        if (!transactionID) {
                            return;
                        }

                        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CATEGORY.getRoute(action, iouType, transactionID, reportID, Navigation.getActiveRoute(), reportActionID));
                    }}
                    style={[styles.moneyRequestMenuItem]}
                    titleStyle={styles.flex1}
                    disabled={didConfirm}
                    interactive={!isReadOnly}
                    rightLabel={isCategoryRequired ? translate('common.required') : ''}
                />
            ),
            shouldShow: shouldShowCategories,
        },
        {
            item: (
                <MenuItemWithTopDescription
                    key={translate('common.date')}
                    shouldShowRightIcon={!isReadOnly}
                    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                    title={iouCreated || format(new Date(), CONST.DATE.FNS_FORMAT_STRING)}
                    description={translate('common.date')}
                    style={[styles.moneyRequestMenuItem]}
                    titleStyle={styles.flex1}
                    onPress={() => {
                        if (!transactionID) {
                            return;
                        }

                        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_DATE.getRoute(action, iouType, transactionID, reportID, Navigation.getActiveRoute(), reportActionID));
                    }}
                    disabled={didConfirm}
                    interactive={!isReadOnly}
                    brickRoadIndicator={shouldDisplayFieldError && isCreatedMissing(transaction) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
                    errorText={shouldDisplayFieldError && isCreatedMissing(transaction) ? translate('common.error.enterDate') : ''}
                />
            ),
            shouldShow: shouldShowDate,
        },
        ...policyTagLists.map(({name}, index) => {
            const tagVisibilityItem = tagVisibility.at(index);
            const isTagRequired = tagVisibilityItem?.isTagRequired ?? false;
            const shouldShow = tagVisibilityItem?.shouldShow ?? false;
            const prevShouldShow = previousTagsVisibility.at(index) ?? false;
            return {
                item: (
                    <MenuItemWithTopDescription
                        highlighted={shouldShow && !getTagForDisplay(transaction, index) && !prevShouldShow}
                        key={name}
                        shouldShowRightIcon={!isReadOnly}
                        title={getTagForDisplay(transaction, index)}
                        description={name}
                        shouldShowBasicTitle
                        shouldShowDescriptionOnTop
                        numberOfLinesTitle={2}
                        onPress={() => {
                            if (!transactionID) {
                                return;
                            }

                            Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_TAG.getRoute(action, iouType, index, transactionID, reportID, Navigation.getActiveRoute(), reportActionID));
                        }}
                        style={[styles.moneyRequestMenuItem]}
                        disabled={didConfirm}
                        interactive={!isReadOnly}
                        rightLabel={isTagRequired ? translate('common.required') : ''}
                    />
                ),
                shouldShow,
            };
        }),
        {
            item: (
                <MenuItemWithTopDescription
                    key={`${taxRates?.name}${taxRateTitle}`}
                    shouldShowRightIcon={canModifyTaxFields}
                    title={taxRateTitle}
                    description={taxRates?.name}
                    style={[styles.moneyRequestMenuItem]}
                    titleStyle={styles.flex1}
                    onPress={() => {
                        if (!transactionID) {
                            return;
                        }

                        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_TAX_RATE.getRoute(action, iouType, transactionID, reportID, Navigation.getActiveRoute()));
                    }}
                    disabled={didConfirm}
                    interactive={canModifyTaxFields}
                />
            ),
            shouldShow: shouldShowTax,
        },
        {
            item: (
                <MenuItemWithTopDescription
                    key={`${taxRates?.name}${formattedTaxAmount}`}
                    shouldShowRightIcon={canModifyTaxFields}
                    title={formattedTaxAmount}
                    description={translate('iou.taxAmount')}
                    style={[styles.moneyRequestMenuItem]}
                    titleStyle={styles.flex1}
                    onPress={() => {
                        if (!transactionID) {
                            return;
                        }

                        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_TAX_AMOUNT.getRoute(action, iouType, transactionID, reportID, Navigation.getActiveRoute()));
                    }}
                    disabled={didConfirm}
                    interactive={canModifyTaxFields}
                />
            ),
            shouldShow: shouldShowTax,
        },
        {
            item: (
                <MenuItemWithTopDescription
                    key="attendees"
                    shouldShowRightIcon
                    title={iouAttendees?.map((item) => item?.displayName ?? item?.login).join(', ')}
                    description={`${translate('iou.attendees')} ${
                        iouAttendees?.length && iouAttendees.length > 1 && formattedAmountPerAttendee ? `\u00B7 ${formattedAmountPerAttendee} ${translate('common.perPerson')}` : ''
                    }`}
                    style={[styles.moneyRequestMenuItem]}
                    titleStyle={styles.flex1}
                    onPress={() => {
                        if (!transactionID) {
                            return;
                        }

                        Navigation.navigate(ROUTES.MONEY_REQUEST_ATTENDEE.getRoute(action, iouType, transactionID, reportID, Navigation.getActiveRoute()));
                    }}
                    interactive
                    shouldRenderAsHTML
                />
            ),
            shouldShow: shouldShowAttendees,
        },
        {
            item: (
                <View
                    key={translate('common.billable')}
                    style={[styles.flexRow, styles.justifyContentBetween, styles.alignItemsCenter, styles.ml5, styles.mr8, styles.optionRow]}
                >
                    <ToggleSettingOptionRow
                        switchAccessibilityLabel={translate('common.billable')}
                        title={translate('common.billable')}
                        onToggle={(isOn) => onToggleBillable?.(isOn)}
                        isActive={iouIsBillable}
                        disabled={isReadOnly}
                        wrapperStyle={styles.flex1}
                    />
                </View>
            ),
            shouldShow: shouldShowBillable,
        },
        {
            item: (
                <MenuItemWithTopDescription
                    key={translate('common.report')}
                    shouldShowRightIcon={shouldReportBeEditable}
                    title={reportName}
                    description={translate('common.report')}
                    style={[styles.moneyRequestMenuItem]}
                    titleStyle={styles.flex1}
                    onPress={() => {
                        if (!transactionID) {
                            return;
                        }
                        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_REPORT.getRoute(action, iouType, transactionID, reportID, Navigation.getActiveRoute()));
                    }}
                    interactive={shouldReportBeEditable}
                    shouldRenderAsHTML
                />
            ),
            shouldShow: isPolicyExpenseChat,
        },
    ];

    const subRates = getSubratesFields(perDiemCustomUnit, transaction);
    const shouldDisplaySubrateError =
        isPerDiemRequest && (shouldDisplayFieldError || formError === 'iou.error.invalidSubrateLength') && (subRates.length === 0 || (subRates.length === 1 && !subRates.at(0)));

    const subRateFields = subRates.map((field, index) => (
        <MenuItemWithTopDescription
            key={`${translate('common.subrate')}${field?.key ?? index}`}
            shouldShowRightIcon={!isReadOnly}
            title={getSubratesForDisplay(field, translate('iou.qty'))}
            description={translate('common.subrate')}
            style={[styles.moneyRequestMenuItem]}
            titleStyle={styles.flex1}
            onPress={() => {
                if (!transactionID) {
                    return;
                }
                Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_SUBRATE_EDIT.getRoute(action, iouType, transactionID, reportID, index, Navigation.getActiveRoute()));
            }}
            disabled={didConfirm}
            interactive={!isReadOnly}
            brickRoadIndicator={index === 0 && shouldDisplaySubrateError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
            errorText={index === 0 && shouldDisplaySubrateError ? translate('common.error.fieldRequired') : ''}
        />
    ));

    const {firstDay, tripDays, lastDay} = getTimeDifferenceIntervals(transaction);

    const badgeElements = useMemo(() => {
        const badges: React.JSX.Element[] = [];
        if (firstDay) {
            badges.push(
                <Badge
                    key="firstDay"
                    icon={Expensicons.Stopwatch}
                    text={translate('iou.firstDayText', {count: firstDay})}
                />,
            );
        }
        if (tripDays) {
            badges.push(
                <Badge
                    key="tripDays"
                    icon={Expensicons.CalendarSolid}
                    text={translate('iou.tripLengthText', {count: tripDays})}
                />,
            );
        }
        if (lastDay) {
            badges.push(
                <Badge
                    key="lastDay"
                    icon={Expensicons.Stopwatch}
                    text={translate('iou.lastDayText', {count: lastDay})}
                />,
            );
        }
        return badges;
    }, [firstDay, lastDay, translate, tripDays]);

    const receiptThumbnailContent = useMemo(
        () => (
            <View style={[styles.moneyRequestImage, styles.expenseViewImageSmall]}>
                {isLocalFile && Str.isPDF(receiptFilename) ? (
                    <PressableWithoutFocus
                        onPress={() => {
                            if (!transactionID) {
                                return;
                            }

                            Navigation.navigate(
                                isReceiptEditable
                                    ? ROUTES.TRANSACTION_RECEIPT.getRoute(reportID, transactionID, undefined, undefined, action, iouType)
                                    : ROUTES.TRANSACTION_RECEIPT.getRoute(reportID, transactionID),
                            );
                        }}
                        accessibilityRole={CONST.ROLE.BUTTON}
                        accessibilityLabel={translate('accessibilityHints.viewAttachment')}
                        disabled={!shouldDisplayReceipt}
                        disabledStyle={styles.cursorDefault}
                    >
                        <PDFThumbnail
                            // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
                            previewSourceURL={resolvedReceiptImage as string}
                            onLoadError={onPDFLoadError}
                            onPassword={onPDFPassword}
                        />
                    </PressableWithoutFocus>
                ) : (
                    <PressableWithoutFocus
                        onPress={() => {
                            if (!transactionID) {
                                return;
                            }

                            Navigation.navigate(
                                isReceiptEditable
                                    ? ROUTES.TRANSACTION_RECEIPT.getRoute(reportID, transactionID, undefined, undefined, action, iouType)
                                    : ROUTES.TRANSACTION_RECEIPT.getRoute(reportID, transactionID),
                            );
                        }}
                        disabled={!shouldDisplayReceipt || isThumbnail}
                        accessibilityRole={CONST.ROLE.BUTTON}
                        accessibilityLabel={translate('accessibilityHints.viewAttachment')}
                        disabledStyle={styles.cursorDefault}
                        style={[styles.h100, styles.flex1]}
                    >
                        <ReceiptImage
                            isThumbnail={isThumbnail}
                            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                            source={resolvedThumbnail || resolvedReceiptImage || ''}
                            // AuthToken is required when retrieving the image from the server
                            // but we don't need it to load the blob:// or file:// image when starting an expense/split
                            // So if we have a thumbnail, it means we're retrieving the image from the server
                            isAuthTokenRequired={!!receiptThumbnail && !isLocalFile}
                            fileExtension={fileExtension}
                            shouldUseThumbnailImage
                            shouldUseInitialObjectPosition={isDistanceRequest}
                        />
                    </PressableWithoutFocus>
                )}
            </View>
        ),
        [
            styles.moneyRequestImage,
            styles.expenseViewImageSmall,
            styles.cursorDefault,
            styles.h100,
            styles.flex1,
            isLocalFile,
            receiptFilename,
            translate,
            shouldDisplayReceipt,
            resolvedReceiptImage,
            onPDFLoadError,
            onPDFPassword,
            isThumbnail,
            resolvedThumbnail,
            receiptThumbnail,
            fileExtension,
            isDistanceRequest,
            transactionID,
            action,
            iouType,
            reportID,
            isReceiptEditable,
        ],
    );

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const hasReceiptImageOrThumbnail = receiptImage || receiptThumbnail;

    return (
        <>
            {isTypeInvoice && (
                <MenuItem
                    key={translate('workspace.invoices.sendFrom')}
                    avatarID={senderWorkspace?.id}
                    shouldShowRightIcon={!isReadOnly && canUpdateSenderWorkspace}
                    title={senderWorkspace?.name}
                    icon={senderWorkspace?.avatarURL ? senderWorkspace?.avatarURL : getDefaultWorkspaceAvatar(senderWorkspace?.name)}
                    iconType={CONST.ICON_TYPE_WORKSPACE}
                    description={translate('workspace.common.workspace')}
                    label={translate('workspace.invoices.sendFrom')}
                    isLabelHoverable={false}
                    interactive={!isReadOnly && canUpdateSenderWorkspace}
                    onPress={() => {
                        if (!transaction?.transactionID) {
                            return;
                        }
                        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_SEND_FROM.getRoute(iouType, transaction?.transactionID, reportID, Navigation.getActiveRoute()));
                    }}
                    style={styles.moneyRequestMenuItem}
                    labelStyle={styles.mt2}
                    titleStyle={styles.flex1}
                    disabled={didConfirm}
                />
            )}
            {shouldShowMap && (
                <View style={styles.confirmationListMapItem}>
                    <ConfirmedRoute transaction={transaction ?? ({} as OnyxTypes.Transaction)} />
                </View>
            )}
            {isPerDiemRequest && action !== CONST.IOU.ACTION.SUBMIT && (
                <>
                    <MenuItemWithTopDescription
                        shouldShowRightIcon={!isReadOnly}
                        title={getDestinationForDisplay(perDiemCustomUnit, transaction)}
                        description={translate('common.destination')}
                        style={[styles.moneyRequestMenuItem]}
                        titleStyle={styles.flex1}
                        onPress={() => {
                            if (!transactionID) {
                                return;
                            }
                            Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_DESTINATION_EDIT.getRoute(action, iouType, transactionID, reportID, Navigation.getActiveRoute()));
                        }}
                        disabled={didConfirm}
                        interactive={!isReadOnly}
                    />
                    <View style={styles.dividerLine} />
                    <MenuItemWithTopDescription
                        shouldShowRightIcon={!isReadOnly}
                        title={getTimeForDisplay(transaction)}
                        description={translate('iou.time')}
                        style={[styles.moneyRequestMenuItem]}
                        titleStyle={styles.flex1}
                        onPress={() => {
                            if (!transactionID) {
                                return;
                            }
                            Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_TIME_EDIT.getRoute(action, iouType, transactionID, reportID));
                        }}
                        disabled={didConfirm}
                        interactive={!isReadOnly}
                        numberOfLinesTitle={2}
                    />
                    <View style={[styles.flexRow, styles.gap1, styles.justifyContentStart, styles.mh3, styles.flexWrap, styles.pt1]}>{badgeElements}</View>
                    <View style={styles.dividerLine} />
                    {subRateFields}
                    <View style={styles.dividerLine} />
                </>
            )}
            {!shouldShowMap && (
                <View style={!hasReceiptImageOrThumbnail && !shouldShowReceiptEmptyState ? undefined : styles.mv3}>
                    {hasReceiptImageOrThumbnail
                        ? receiptThumbnailContent
                        : shouldShowReceiptEmptyState && (
                              <ReceiptEmptyState
                                  onPress={() => {
                                      if (!transactionID) {
                                          return;
                                      }

                                      Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_SCAN.getRoute(CONST.IOU.ACTION.CREATE, iouType, transactionID, reportID, Navigation.getActiveRoute()));
                                  }}
                                  style={styles.expenseViewImageSmall}
                              />
                          )}
                </View>
            )}
            <View style={[styles.mb5]}>{fields.filter((field) => field.shouldShow).map((field) => field.item)}</View>
        </>
    );
}

MoneyRequestConfirmationListFooter.displayName = 'MoneyRequestConfirmationListFooter';

export default memo(
    MoneyRequestConfirmationListFooter,
    (prevProps, nextProps) =>
        deepEqual(prevProps.action, nextProps.action) &&
        prevProps.currency === nextProps.currency &&
        prevProps.didConfirm === nextProps.didConfirm &&
        prevProps.distance === nextProps.distance &&
        prevProps.formattedAmount === nextProps.formattedAmount &&
        prevProps.formError === nextProps.formError &&
        prevProps.hasRoute === nextProps.hasRoute &&
        prevProps.iouCategory === nextProps.iouCategory &&
        prevProps.iouComment === nextProps.iouComment &&
        prevProps.iouCreated === nextProps.iouCreated &&
        prevProps.iouCurrencyCode === nextProps.iouCurrencyCode &&
        prevProps.iouIsBillable === nextProps.iouIsBillable &&
        prevProps.iouMerchant === nextProps.iouMerchant &&
        prevProps.iouType === nextProps.iouType &&
        prevProps.isCategoryRequired === nextProps.isCategoryRequired &&
        prevProps.isDistanceRequest === nextProps.isDistanceRequest &&
        prevProps.isMerchantEmpty === nextProps.isMerchantEmpty &&
        prevProps.isMerchantRequired === nextProps.isMerchantRequired &&
        prevProps.isPolicyExpenseChat === nextProps.isPolicyExpenseChat &&
        prevProps.isReadOnly === nextProps.isReadOnly &&
        prevProps.isTypeInvoice === nextProps.isTypeInvoice &&
        prevProps.onToggleBillable === nextProps.onToggleBillable &&
        deepEqual(prevProps.policy, nextProps.policy) &&
        deepEqual(prevProps.policyTagLists, nextProps.policyTagLists) &&
        prevProps.rate === nextProps.rate &&
        prevProps.receiptFilename === nextProps.receiptFilename &&
        prevProps.receiptPath === nextProps.receiptPath &&
        prevProps.reportActionID === nextProps.reportActionID &&
        prevProps.reportID === nextProps.reportID &&
        deepEqual(prevProps.selectedParticipants, nextProps.selectedParticipants) &&
        prevProps.shouldDisplayFieldError === nextProps.shouldDisplayFieldError &&
        prevProps.shouldDisplayReceipt === nextProps.shouldDisplayReceipt &&
        prevProps.shouldShowCategories === nextProps.shouldShowCategories &&
        prevProps.shouldShowMerchant === nextProps.shouldShowMerchant &&
        prevProps.shouldShowSmartScanFields === nextProps.shouldShowSmartScanFields &&
        prevProps.shouldShowTax === nextProps.shouldShowTax &&
        deepEqual(prevProps.transaction, nextProps.transaction) &&
        prevProps.transactionID === nextProps.transactionID &&
        prevProps.unit === nextProps.unit,
);
