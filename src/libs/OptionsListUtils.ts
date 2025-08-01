/* eslint-disable @typescript-eslint/prefer-for-of */
import {Str} from 'expensify-common';
import deburr from 'lodash/deburr';
import keyBy from 'lodash/keyBy';
import lodashOrderBy from 'lodash/orderBy';
import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import type {SetNonNullable} from 'type-fest';
import {FallbackAvatar} from '@components/Icon/Expensicons';
import type {PolicyTagList} from '@pages/workspace/tags/types';
import type {IOUAction} from '@src/CONST';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {
    Beta,
    DismissedProductTraining,
    Login,
    OnyxInputOrEntry,
    PersonalDetails,
    PersonalDetailsList,
    Policy,
    PolicyCategories,
    PolicyCategory,
    PolicyTag,
    PolicyTagLists,
    Report,
    ReportAction,
    ReportActions,
    ReportAttributesDerivedValue,
    ReportNameValuePairs,
    TransactionViolation,
} from '@src/types/onyx';
import type {Attendee, Participant} from '@src/types/onyx/IOU';
import type {Icon, PendingAction} from '@src/types/onyx/OnyxCommon';
import type {OriginalMessageMovedTransaction} from '@src/types/onyx/OriginalMessage';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import Timing from './actions/Timing';
import {getEnabledCategoriesCount} from './CategoryUtils';
import filterArrayByMatch from './filterArrayByMatch';
import {isReportMessageAttachment} from './isReportMessageAttachment';
import localeCompare from './LocaleCompare';
import {formatPhoneNumber} from './LocalePhoneNumber';
import {translateLocal} from './Localize';
import {appendCountryCode, getPhoneNumberWithoutSpecialChars} from './LoginUtils';
import {MaxHeap} from './MaxHeap';
import {MinHeap} from './MinHeap';
import ModifiedExpenseMessage from './ModifiedExpenseMessage';
import Navigation from './Navigation/Navigation';
import Parser from './Parser';
import Performance from './Performance';
import Permissions from './Permissions';
import {getDisplayNameOrDefault, getPersonalDetailByEmail, getPersonalDetailsByIDs} from './PersonalDetailsUtils';
import {addSMSDomainIfPhoneNumber, parsePhoneNumber} from './PhoneNumber';
import {
    canSendInvoiceFromWorkspace,
    canSubmitPerDiemExpenseFromWorkspace,
    getCountOfEnabledTagsOfList,
    getCountOfRequiredTagLists,
    getSubmitToAccountID,
    isUserInvitedToWorkspace,
} from './PolicyUtils';
import {
    getCombinedReportActions,
    getExportIntegrationLastMessageText,
    getIOUReportIDFromReportActionPreview,
    getJoinRequestMessage,
    getLastVisibleMessage,
    getLeaveRoomMessage,
    getMentionedAccountIDsFromAction,
    getMessageOfOldDotReportAction,
    getOneTransactionThreadReportID,
    getOriginalMessage,
    getReceiptScanFailedMessage,
    getRenamedAction,
    getReopenedMessage,
    getReportActionHtml,
    getReportActionMessageText,
    getRetractedMessage,
    getSortedReportActions,
    getTravelUpdateMessage,
    getUpdateRoomDescriptionMessage,
    isActionableAddPaymentCard,
    isActionableJoinRequest,
    isActionOfType,
    isAddCommentAction,
    isClosedAction,
    isCreatedTaskReportAction,
    isDeletedAction,
    isDeletedParentAction,
    isMarkAsClosedAction,
    isModifiedExpenseAction,
    isMoneyRequestAction,
    isMovedTransactionAction,
    isOldDotReportAction,
    isPendingRemove,
    isReimbursementDeQueuedOrCanceledAction,
    isReimbursementQueuedAction,
    isRenamedAction,
    isReportPreviewAction,
    isTaskAction,
    isThreadParentMessage,
    isUnapprovedAction,
    shouldReportActionBeVisible,
} from './ReportActionsUtils';
import type {OptionData} from './ReportUtils';
import {
    canUserPerformWriteAction,
    formatReportLastMessageText,
    getChatByParticipants,
    getChatRoomSubtitle,
    getDeletedParentActionMessageForChatReport,
    getDeletedTransactionMessage,
    getDisplayNameForParticipant,
    getDowngradeWorkspaceMessage,
    getIcons,
    getMoneyRequestSpendBreakdown,
    getMovedTransactionMessage,
    getParticipantsAccountIDsForDisplay,
    getPolicyChangeMessage,
    getPolicyName,
    getReimbursementDeQueuedOrCanceledActionMessage,
    getReimbursementQueuedActionMessage,
    getRejectedReportMessage,
    getReportLastMessage,
    getReportName,
    getReportNotificationPreference,
    getReportOrDraftReport,
    getReportParticipantsTitle,
    getReportPreviewMessage,
    getReportSubtitlePrefix,
    getUpgradeWorkspaceMessage,
    hasIOUWaitingOnCurrentUserBankAccount,
    isArchivedNonExpenseReport,
    isChatThread,
    isDefaultRoom,
    isDM,
    isDraftReport,
    isExpenseReport,
    isHiddenForCurrentUser,
    isInvoiceRoom,
    isIOUOwnedByCurrentUser,
    isMoneyRequest,
    isPolicyAdmin,
    isUnread,
    isAdminRoom as reportUtilsIsAdminRoom,
    isAnnounceRoom as reportUtilsIsAnnounceRoom,
    isChatReport as reportUtilsIsChatReport,
    isChatRoom as reportUtilsIsChatRoom,
    isGroupChat as reportUtilsIsGroupChat,
    isMoneyRequestReport as reportUtilsIsMoneyRequestReport,
    isOneOnOneChat as reportUtilsIsOneOnOneChat,
    isPolicyExpenseChat as reportUtilsIsPolicyExpenseChat,
    isSelfDM as reportUtilsIsSelfDM,
    isTaskReport as reportUtilsIsTaskReport,
    shouldDisplayViolationsRBRInLHN,
    shouldReportBeInOptionList,
    shouldReportShowSubscript,
} from './ReportUtils';
import StringUtils from './StringUtils';
import {getTaskCreatedMessage, getTaskReportActionMessage} from './TaskUtils';
import type {AvatarSource} from './UserUtils';
import {generateAccountID} from './UserUtils';

type SearchOption<T> = OptionData & {
    item: T;
};

type OptionList = {
    reports: Array<SearchOption<Report>>;
    personalDetails: Array<SearchOption<PersonalDetails>>;
};

type Option = Partial<OptionData>;

/**
 * A narrowed version of `Option` is used when we have a guarantee that given values exist.
 */
type OptionTree = {
    text: string;
    keyForList: string;
    searchText: string;
    tooltipText: string;
    isDisabled: boolean;
    isSelected: boolean;
    pendingAction?: PendingAction;
} & Option;

type PayeePersonalDetails = {
    text: string;
    alternateText: string;
    icons: Icon[];
    descriptiveText: string;
    login: string;
    accountID: number;
    keyForList: string;
    isInteractive: boolean;
};

type SectionBase = {
    title: string | undefined;
    shouldShow: boolean;
};

type Section = SectionBase & {
    data: Option[];
};

type GetValidOptionsSharedConfig = {
    includeP2P?: boolean;
    transactionViolations?: OnyxCollection<TransactionViolation[]>;
    action?: IOUAction;
    shouldBoldTitleByDefault?: boolean;
    selectedOptions?: Option[];
};

type GetValidReportsConfig = {
    betas?: OnyxEntry<Beta[]>;
    includeMultipleParticipantReports?: boolean;
    showChatPreviewLine?: boolean;
    forcePolicyNamePreview?: boolean;
    includeSelfDM?: boolean;
    includeOwnedWorkspaceChats?: boolean;
    includeThreads?: boolean;
    includeTasks?: boolean;
    includeMoneyRequests?: boolean;
    includeInvoiceRooms?: boolean;
    includeDomainEmail?: boolean;
    includeReadOnly?: boolean;
    loginsToExclude?: Record<string, boolean>;
    shouldSeparateWorkspaceChat?: boolean;
    shouldSeparateSelfDMChat?: boolean;
    excludeNonAdminWorkspaces?: boolean;
    isPerDiemRequest?: boolean;
    showRBR?: boolean;
} & GetValidOptionsSharedConfig;

type GetValidReportsReturnTypeCombined = {
    selfDMOption: OptionData | undefined;
    workspaceOptions: OptionData[];
    recentReports: OptionData[];
};

type GetOptionsConfig = {
    excludeLogins?: Record<string, boolean>;
    includeCurrentUser?: boolean;
    includeRecentReports?: boolean;
    includeSelectedOptions?: boolean;
    recentAttendees?: Option[];
    excludeHiddenThreads?: boolean;
    canShowManagerMcTest?: boolean;
    searchString?: string;
    maxElements?: number;
    includeUserToInvite?: boolean;
} & GetValidReportsConfig;

type GetUserToInviteConfig = {
    searchValue: string | undefined;
    loginsToExclude?: Record<string, boolean>;
    reportActions?: ReportActions;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    avatar?: AvatarSource;
    shouldAcceptName?: boolean;
    optionsToExclude?: GetOptionsConfig['selectedOptions'];
} & Pick<GetOptionsConfig, 'selectedOptions' | 'showChatPreviewLine'>;

type MemberForList = {
    text: string;
    alternateText: string;
    keyForList: string;
    isSelected: boolean;
    isDisabled: boolean;
    accountID?: number;
    login: string;
    icons?: Icon[];
    pendingAction?: PendingAction;
    reportID: string;
};

type SectionForSearchTerm = {
    section: Section;
};
type Options = {
    recentReports: OptionData[];
    personalDetails: OptionData[];
    userToInvite: OptionData | null;
    currentUserOption: OptionData | null | undefined;
    workspaceChats?: OptionData[];
    selfDMChat?: OptionData | undefined;
};

type PreviewConfig = {
    showChatPreviewLine?: boolean;
    forcePolicyNamePreview?: boolean;
    showPersonalDetails?: boolean;
    isDisabled?: boolean | null;
    selected?: boolean;
    isSelected?: boolean;
};

type FilterUserToInviteConfig = Pick<GetUserToInviteConfig, 'selectedOptions' | 'shouldAcceptName'> & {
    canInviteUser?: boolean;
    excludeLogins?: Record<string, boolean>;
};

type OrderOptionsConfig =
    | {
          maxRecentReportsToShow?: never;
          /* When sortByReportTypeInSearch flag is true, recentReports will include the personalDetails options as well. */
          sortByReportTypeInSearch?: true;
      }
    | {
          // When specifying maxRecentReportsToShow, you can't sort by report type in search
          maxRecentReportsToShow?: number;
          sortByReportTypeInSearch?: false;
      };

type OrderReportOptionsConfig = {
    preferChatRoomsOverThreads?: boolean;
    preferPolicyExpenseChat?: boolean;
    preferRecentExpenseReports?: boolean;
};

type ReportAndPersonalDetailOptions = Pick<Options, 'recentReports' | 'personalDetails' | 'workspaceChats'>;

/**
 * OptionsListUtils is used to build a list options passed to the OptionsList component. Several different UI views can
 * be configured to display different results based on the options passed to the private getOptions() method. Public
 * methods should be named for the views they build options for and then exported for use in a component.
 */
let currentUserLogin: string | undefined;
let currentUserAccountID: number | undefined;
Onyx.connect({
    key: ONYXKEYS.SESSION,
    callback: (value) => {
        currentUserLogin = value?.email;
        currentUserAccountID = value?.accountID;
    },
});

let loginList: OnyxEntry<Login>;
Onyx.connect({
    key: ONYXKEYS.LOGIN_LIST,
    callback: (value) => (loginList = isEmptyObject(value) ? {} : value),
});

let allPersonalDetails: OnyxEntry<PersonalDetailsList>;
Onyx.connect({
    key: ONYXKEYS.PERSONAL_DETAILS_LIST,
    callback: (value) => (allPersonalDetails = isEmptyObject(value) ? {} : value),
});

const policies: OnyxCollection<Policy> = {};
Onyx.connect({
    key: ONYXKEYS.COLLECTION.POLICY,
    callback: (policy, key) => {
        if (!policy || !key || !policy.name) {
            return;
        }

        policies[key] = policy;
    },
});

let allPolicies: OnyxCollection<Policy> = {};
Onyx.connect({
    key: ONYXKEYS.COLLECTION.POLICY,
    waitForCollectionCallback: true,
    callback: (val) => (allPolicies = val),
});

let allReports: OnyxCollection<Report>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT,
    waitForCollectionCallback: true,
    callback: (value) => {
        allReports = value;
    },
});

let allReportNameValuePairs: OnyxCollection<ReportNameValuePairs>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS,
    waitForCollectionCallback: true,
    callback: (value) => {
        allReportNameValuePairs = value;
    },
});

const lastReportActions: ReportActions = {};
const allSortedReportActions: Record<string, ReportAction[]> = {};
let allReportActions: OnyxCollection<ReportActions>;
const lastVisibleReportActions: ReportActions = {};
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_ACTIONS,
    waitForCollectionCallback: true,
    callback: (actions) => {
        if (!actions) {
            return;
        }

        allReportActions = actions ?? {};

        // Iterate over the report actions to build the sorted and lastVisible report actions objects
        Object.entries(allReportActions).forEach((reportActions) => {
            const reportID = reportActions[0].split('_').at(1);
            if (!reportID) {
                return;
            }

            const reportActionsArray = Object.values(reportActions[1] ?? {});
            let sortedReportActions = getSortedReportActions(reportActionsArray, true);
            allSortedReportActions[reportID] = sortedReportActions;
            const report = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
            const chatReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.chatReportID}`];

            // If the report is a one-transaction report and has , we need to return the combined reportActions so that the LHN can display modifications
            // to the transaction thread or the report itself
            const transactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, actions[reportActions[0]]);
            if (transactionThreadReportID) {
                const transactionThreadReportActionsArray = Object.values(actions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`] ?? {});
                sortedReportActions = getCombinedReportActions(sortedReportActions, transactionThreadReportID, transactionThreadReportActionsArray, reportID);
            }

            const firstReportAction = sortedReportActions.at(0);
            if (!firstReportAction) {
                delete lastReportActions[reportID];
            } else {
                lastReportActions[reportID] = firstReportAction;
            }

            const isWriteActionAllowed = canUserPerformWriteAction(report);

            // The report is only visible if it is the last action not deleted that
            // does not match a closed or created state.
            const reportActionsForDisplay = sortedReportActions.filter(
                (reportAction, actionKey) =>
                    shouldReportActionBeVisible(reportAction, actionKey, isWriteActionAllowed) &&
                    reportAction.actionName !== CONST.REPORT.ACTIONS.TYPE.CREATED &&
                    reportAction.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
            );
            const reportActionForDisplay = reportActionsForDisplay.at(0);
            if (!reportActionForDisplay) {
                delete lastVisibleReportActions[reportID];
                return;
            }
            lastVisibleReportActions[reportID] = reportActionForDisplay;
        });
    },
});

let activePolicyID: OnyxEntry<string>;
Onyx.connect({
    key: ONYXKEYS.NVP_ACTIVE_POLICY_ID,
    callback: (value) => (activePolicyID = value),
});

let nvpDismissedProductTraining: OnyxEntry<DismissedProductTraining>;
Onyx.connect({
    key: ONYXKEYS.NVP_DISMISSED_PRODUCT_TRAINING,
    callback: (value) => (nvpDismissedProductTraining = value),
});

/**
 * @param defaultValues {login: accountID} In workspace invite page, when new user is added we pass available data to opt in
 * @returns Returns avatar data for a list of user accountIDs
 */
function getAvatarsForAccountIDs(accountIDs: number[], personalDetails: OnyxEntry<PersonalDetailsList>, defaultValues: Record<string, number> = {}): Icon[] {
    const reversedDefaultValues: Record<number, string> = {};

    Object.entries(defaultValues).forEach((item) => {
        reversedDefaultValues[item[1]] = item[0];
    });

    return accountIDs.map((accountID) => {
        const login = reversedDefaultValues[accountID] ?? '';
        const userPersonalDetail = personalDetails?.[accountID] ?? {login, accountID};

        return {
            id: accountID,
            source: userPersonalDetail.avatar ?? FallbackAvatar,
            type: CONST.ICON_TYPE_AVATAR,
            name: userPersonalDetail.login ?? '',
        };
    });
}

/**
 * Returns the personal details for an array of accountIDs
 * @returns keys of the object are emails, values are PersonalDetails objects.
 */
function getPersonalDetailsForAccountIDs(accountIDs: number[] | undefined, personalDetails: OnyxInputOrEntry<PersonalDetailsList>): SetNonNullable<PersonalDetailsList> {
    const personalDetailsForAccountIDs: SetNonNullable<PersonalDetailsList> = {};
    if (!personalDetails) {
        return personalDetailsForAccountIDs;
    }
    accountIDs?.forEach((accountID) => {
        const cleanAccountID = Number(accountID);
        if (!cleanAccountID) {
            return;
        }
        let personalDetail: OnyxEntry<PersonalDetails> = personalDetails[accountID] ?? undefined;
        if (!personalDetail) {
            personalDetail = {} as PersonalDetails;
        }

        if (cleanAccountID === CONST.ACCOUNT_ID.CONCIERGE) {
            personalDetail.avatar = CONST.CONCIERGE_ICON_URL;
        }

        personalDetail.accountID = cleanAccountID;
        personalDetailsForAccountIDs[cleanAccountID] = personalDetail;
    });
    return personalDetailsForAccountIDs;
}

/**
 * Return true if personal details data is ready, i.e. report list options can be created.
 */
function isPersonalDetailsReady(personalDetails: OnyxEntry<PersonalDetailsList>): boolean {
    const personalDetailsKeys = Object.keys(personalDetails ?? {});
    return personalDetailsKeys.some((key) => personalDetails?.[key]?.accountID);
}

/**
 * Get the participant option for a report.
 */
function getParticipantsOption(participant: OptionData | Participant, personalDetails: OnyxEntry<PersonalDetailsList>): Participant {
    const detail = participant.accountID ? getPersonalDetailsForAccountIDs([participant.accountID], personalDetails)[participant.accountID] : undefined;
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const login = detail?.login || participant.login || '';
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const displayName = participant?.displayName || formatPhoneNumber(getDisplayNameOrDefault(detail, login || participant.text));

    return {
        keyForList: String(detail?.accountID ?? login),
        login,
        accountID: detail?.accountID,
        text: displayName,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        firstName: (detail?.firstName || participant.firstName) ?? '',
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        lastName: (detail?.lastName || participant.lastName) ?? '',
        alternateText: formatPhoneNumber(login) || displayName,
        icons: [
            {
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                source: (participant.avatar || detail?.avatar) ?? FallbackAvatar,
                name: login,
                type: CONST.ICON_TYPE_AVATAR,
                id: detail?.accountID,
            },
        ],
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        phoneNumber: (detail?.phoneNumber || participant?.phoneNumber) ?? '',
        selected: participant.selected,
        isSelected: participant.selected,
        searchText: participant.searchText ?? undefined,
    };
}

/**
 * A very optimized method to remove duplicates from an array.
 * Taken from https://stackoverflow.com/a/9229821/9114791
 */
function uniqFast(items: string[]): string[] {
    const seenItems: Record<string, number> = {};
    const result: string[] = [];
    let j = 0;

    for (const item of items) {
        if (seenItems[item] !== 1) {
            seenItems[item] = 1;
            result[j++] = item;
        }
    }

    return result;
}

/**
 * Get the last actor display name from last actor details.
 */
function getLastActorDisplayName(lastActorDetails: Partial<PersonalDetails> | null) {
    if (!lastActorDetails) {
        return '';
    }

    return lastActorDetails.accountID !== currentUserAccountID
        ? // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          lastActorDetails.firstName || formatPhoneNumber(getDisplayNameOrDefault(lastActorDetails))
        : translateLocal('common.you');
}

/**
 * Should show the last actor display name from last actor details.
 */
function shouldShowLastActorDisplayName(report: OnyxEntry<Report>, lastActorDetails: Partial<PersonalDetails> | null, lastAction: OnyxEntry<ReportAction>) {
    if (
        !lastActorDetails ||
        reportUtilsIsSelfDM(report) ||
        (isDM(report) && lastActorDetails.accountID !== currentUserAccountID) ||
        lastAction?.actionName === CONST.REPORT.ACTIONS.TYPE.IOU ||
        (lastAction?.actionName === CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW &&
            Object.keys(report?.participants ?? {})?.some((participantID) => participantID === CONST.ACCOUNT_ID.MANAGER_MCTEST.toString()))
    ) {
        return false;
    }

    const lastActorDisplayName = getLastActorDisplayName(lastActorDetails);

    if (!lastActorDisplayName) {
        return false;
    }

    return true;
}

/**
 * Update alternate text for the option when applicable
 */
function getAlternateText(option: OptionData, {showChatPreviewLine = false, forcePolicyNamePreview = false}: PreviewConfig) {
    const report = getReportOrDraftReport(option.reportID);
    const isAdminRoom = reportUtilsIsAdminRoom(report);
    const isAnnounceRoom = reportUtilsIsAnnounceRoom(report);
    const isGroupChat = reportUtilsIsGroupChat(report);
    const isExpenseThread = isMoneyRequest(report);
    const formattedLastMessageText = formatReportLastMessageText(Parser.htmlToText(option.lastMessageText ?? ''));
    const reportPrefix = getReportSubtitlePrefix(report);
    const formattedLastMessageTextWithPrefix = reportPrefix + formattedLastMessageText;

    if (isExpenseThread || option.isMoneyRequestReport) {
        return showChatPreviewLine && formattedLastMessageText ? formattedLastMessageTextWithPrefix : translateLocal('iou.expense');
    }

    if (option.isThread) {
        return showChatPreviewLine && formattedLastMessageText ? formattedLastMessageTextWithPrefix : translateLocal('threads.thread');
    }

    if (option.isChatRoom && !isAdminRoom && !isAnnounceRoom) {
        return showChatPreviewLine && formattedLastMessageText ? formattedLastMessageTextWithPrefix : option.subtitle;
    }

    if ((option.isPolicyExpenseChat ?? false) || isAdminRoom || isAnnounceRoom) {
        return showChatPreviewLine && !forcePolicyNamePreview && formattedLastMessageText ? formattedLastMessageTextWithPrefix : option.subtitle;
    }

    if (option.isTaskReport) {
        return showChatPreviewLine && formattedLastMessageText ? formattedLastMessageTextWithPrefix : translateLocal('task.task');
    }

    if (isGroupChat) {
        return showChatPreviewLine && formattedLastMessageText ? formattedLastMessageTextWithPrefix : translateLocal('common.group');
    }

    return showChatPreviewLine && formattedLastMessageText
        ? formattedLastMessageTextWithPrefix
        : formatPhoneNumber(option.participantsList && option.participantsList.length > 0 ? (option.participantsList.at(0)?.login ?? '') : '');
}

/**
 * Searches for a match when provided with a value
 */
function isSearchStringMatch(searchValue: string, searchText?: string | null, participantNames = new Set<string>(), isReportChatRoom = false): boolean {
    const searchWords = new Set(searchValue.replace(/,/g, ' ').split(/\s+/));
    const valueToSearch = searchText?.replace(new RegExp(/&nbsp;/g), '');
    let matching = true;
    searchWords.forEach((word) => {
        // if one of the word is not matching, we don't need to check further
        if (!matching) {
            return;
        }
        const matchRegex = new RegExp(Str.escapeForRegExp(word), 'i');
        matching = matchRegex.test(valueToSearch ?? '') || (!isReportChatRoom && participantNames.has(word));
    });
    return matching;
}

function isSearchStringMatchUserDetails(personalDetail: PersonalDetails, searchValue: string) {
    let memberDetails = '';
    if (personalDetail.login) {
        memberDetails += ` ${personalDetail.login}`;
    }
    if (personalDetail.firstName) {
        memberDetails += ` ${personalDetail.firstName}`;
    }
    if (personalDetail.lastName) {
        memberDetails += ` ${personalDetail.lastName}`;
    }
    if (personalDetail.displayName) {
        memberDetails += ` ${getDisplayNameOrDefault(personalDetail)}`;
    }
    if (personalDetail.phoneNumber) {
        memberDetails += ` ${personalDetail.phoneNumber}`;
    }
    return isSearchStringMatch(searchValue.trim(), memberDetails.toLowerCase());
}

/**
 * Get IOU report ID of report last action if the action is report action preview
 */
function getIOUReportIDOfLastAction(report: OnyxEntry<Report>): string | undefined {
    if (!report?.reportID) {
        return;
    }
    const lastAction = lastVisibleReportActions[report.reportID];
    if (!isReportPreviewAction(lastAction)) {
        return;
    }
    return getReportOrDraftReport(getIOUReportIDFromReportActionPreview(lastAction))?.reportID;
}

function hasHiddenDisplayNames(accountIDs: number[]) {
    return getPersonalDetailsByIDs({accountIDs, currentUserAccountID: 0}).some((personalDetail) => !getDisplayNameOrDefault(personalDetail, undefined, false));
}

/**
 * Get the last message text from the report directly or from other sources for special cases.
 */
function getLastMessageTextForReport(report: OnyxEntry<Report>, lastActorDetails: Partial<PersonalDetails> | null, policy?: OnyxEntry<Policy>, isReportArchived = false): string {
    const reportID = report?.reportID;
    const lastReportAction = reportID ? lastVisibleReportActions[reportID] : undefined;
    const lastVisibleMessage = getLastVisibleMessage(report?.reportID);

    // some types of actions are filtered out for lastReportAction, in some cases we need to check the actual last action
    const lastOriginalReportAction = reportID ? lastReportActions[reportID] : undefined;
    let lastMessageTextFromReport = '';

    if (isArchivedNonExpenseReport(report, isReportArchived)) {
        const archiveReason =
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            (isClosedAction(lastOriginalReportAction) && getOriginalMessage(lastOriginalReportAction)?.reason) || CONST.REPORT.ARCHIVE_REASON.DEFAULT;
        switch (archiveReason) {
            case CONST.REPORT.ARCHIVE_REASON.ACCOUNT_CLOSED:
            case CONST.REPORT.ARCHIVE_REASON.REMOVED_FROM_POLICY:
            case CONST.REPORT.ARCHIVE_REASON.POLICY_DELETED: {
                lastMessageTextFromReport = translateLocal(`reportArchiveReasons.${archiveReason}`, {
                    displayName: formatPhoneNumber(getDisplayNameOrDefault(lastActorDetails)),
                    policyName: getPolicyName({report, policy}),
                });
                break;
            }
            case CONST.REPORT.ARCHIVE_REASON.BOOKING_END_DATE_HAS_PASSED: {
                lastMessageTextFromReport = translateLocal(`reportArchiveReasons.${archiveReason}`);
                break;
            }
            default: {
                lastMessageTextFromReport = translateLocal(`reportArchiveReasons.default`);
            }
        }
    } else if (isMoneyRequestAction(lastReportAction)) {
        const properSchemaForMoneyRequestMessage = getReportPreviewMessage(report, lastReportAction, true, false, null, true);
        lastMessageTextFromReport = formatReportLastMessageText(properSchemaForMoneyRequestMessage);
    } else if (isReportPreviewAction(lastReportAction)) {
        const iouReport = getReportOrDraftReport(getIOUReportIDFromReportActionPreview(lastReportAction));
        const lastIOUMoneyReportAction = iouReport?.reportID
            ? allSortedReportActions[iouReport.reportID]?.find(
                  (reportAction, key): reportAction is ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.IOU> =>
                      shouldReportActionBeVisible(reportAction, key, canUserPerformWriteAction(report)) &&
                      reportAction.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE &&
                      isMoneyRequestAction(reportAction),
              )
            : undefined;
        const reportPreviewMessage = getReportPreviewMessage(
            !isEmptyObject(iouReport) ? iouReport : null,
            lastIOUMoneyReportAction ?? lastReportAction,
            true,
            reportUtilsIsChatReport(report),
            null,
            true,
            lastReportAction,
        );
        lastMessageTextFromReport = formatReportLastMessageText(reportPreviewMessage);
    } else if (isReimbursementQueuedAction(lastReportAction)) {
        lastMessageTextFromReport = getReimbursementQueuedActionMessage({reportAction: lastReportAction, reportOrID: report});
    } else if (isReimbursementDeQueuedOrCanceledAction(lastReportAction)) {
        lastMessageTextFromReport = getReimbursementDeQueuedOrCanceledActionMessage(lastReportAction, report, true);
    } else if (isDeletedParentAction(lastReportAction) && reportUtilsIsChatReport(report)) {
        lastMessageTextFromReport = getDeletedParentActionMessageForChatReport(lastReportAction);
    } else if (isPendingRemove(lastReportAction) && report?.reportID && isThreadParentMessage(lastReportAction, report.reportID)) {
        lastMessageTextFromReport = translateLocal('parentReportAction.hiddenMessage');
    } else if (isReportMessageAttachment({text: report?.lastMessageText ?? '', html: report?.lastMessageHtml, type: ''})) {
        lastMessageTextFromReport = `[${translateLocal('common.attachment')}]`;
    } else if (isModifiedExpenseAction(lastReportAction)) {
        const properSchemaForModifiedExpenseMessage = ModifiedExpenseMessage.getForReportAction({reportOrID: report?.reportID, reportAction: lastReportAction});
        lastMessageTextFromReport = formatReportLastMessageText(properSchemaForModifiedExpenseMessage, true);
    } else if (isMovedTransactionAction(lastReportAction)) {
        const movedTransactionOriginalMessage = getOriginalMessage(lastReportAction) ?? {};
        const {toReportID} = movedTransactionOriginalMessage as OriginalMessageMovedTransaction;
        const toReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${toReportID}`];
        lastMessageTextFromReport = getMovedTransactionMessage(toReport);
    } else if (isTaskAction(lastReportAction)) {
        lastMessageTextFromReport = formatReportLastMessageText(getTaskReportActionMessage(lastReportAction).text);
    } else if (isCreatedTaskReportAction(lastReportAction)) {
        lastMessageTextFromReport = getTaskCreatedMessage(lastReportAction);
    } else if (
        isActionOfType(lastReportAction, CONST.REPORT.ACTIONS.TYPE.SUBMITTED) ||
        isActionOfType(lastReportAction, CONST.REPORT.ACTIONS.TYPE.SUBMITTED_AND_CLOSED) ||
        isMarkAsClosedAction(lastReportAction)
    ) {
        const wasSubmittedViaHarvesting = !isMarkAsClosedAction(lastReportAction) ? (getOriginalMessage(lastReportAction)?.harvesting ?? false) : false;
        if (wasSubmittedViaHarvesting) {
            lastMessageTextFromReport = translateLocal('iou.automaticallySubmitted');
        } else {
            lastMessageTextFromReport = translateLocal('iou.submitted');
        }
    } else if (isActionOfType(lastReportAction, CONST.REPORT.ACTIONS.TYPE.APPROVED)) {
        const {automaticAction} = getOriginalMessage(lastReportAction) ?? {};
        if (automaticAction) {
            lastMessageTextFromReport = translateLocal('iou.automaticallyApproved');
        } else {
            lastMessageTextFromReport = translateLocal('iou.approvedMessage');
        }
    } else if (isUnapprovedAction(lastReportAction)) {
        lastMessageTextFromReport = translateLocal('iou.unapproved');
    } else if (isActionOfType(lastReportAction, CONST.REPORT.ACTIONS.TYPE.FORWARDED)) {
        const {automaticAction} = getOriginalMessage(lastReportAction) ?? {};
        if (automaticAction) {
            lastMessageTextFromReport = translateLocal('iou.automaticallyForwarded');
        } else {
            lastMessageTextFromReport = translateLocal('iou.forwarded');
        }
    } else if (lastReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.REJECTED) {
        lastMessageTextFromReport = getRejectedReportMessage();
    } else if (lastReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.CORPORATE_UPGRADE) {
        lastMessageTextFromReport = getUpgradeWorkspaceMessage();
    } else if (lastReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.TEAM_DOWNGRADE) {
        lastMessageTextFromReport = getDowngradeWorkspaceMessage();
    } else if (isActionableAddPaymentCard(lastReportAction) || isActionOfType(lastReportAction, CONST.REPORT.ACTIONS.TYPE.MOVED)) {
        lastMessageTextFromReport = getReportActionMessageText(lastReportAction);
    } else if (lastReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.EXPORTED_TO_INTEGRATION) {
        lastMessageTextFromReport = getExportIntegrationLastMessageText(lastReportAction);
    } else if (lastReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.RECEIPT_SCAN_FAILED) {
        lastMessageTextFromReport = getReceiptScanFailedMessage();
    } else if (lastReportAction?.actionName && isOldDotReportAction(lastReportAction)) {
        lastMessageTextFromReport = getMessageOfOldDotReportAction(lastReportAction, false);
    } else if (isActionableJoinRequest(lastReportAction)) {
        lastMessageTextFromReport = getJoinRequestMessage(lastReportAction);
    } else if (lastReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.ROOM_CHANGE_LOG.LEAVE_ROOM) {
        lastMessageTextFromReport = getLeaveRoomMessage();
    } else if (lastReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.RESOLVED_DUPLICATES) {
        lastMessageTextFromReport = translateLocal('violations.resolvedDuplicates');
    } else if (isActionOfType(lastReportAction, CONST.REPORT.ACTIONS.TYPE.ROOM_CHANGE_LOG.UPDATE_ROOM_DESCRIPTION)) {
        lastMessageTextFromReport = getUpdateRoomDescriptionMessage(lastReportAction);
    } else if (isActionOfType(lastReportAction, CONST.REPORT.ACTIONS.TYPE.RETRACTED)) {
        lastMessageTextFromReport = getRetractedMessage();
    } else if (isActionOfType(lastReportAction, CONST.REPORT.ACTIONS.TYPE.REOPENED)) {
        lastMessageTextFromReport = getReopenedMessage();
    } else if (isActionOfType(lastReportAction, CONST.REPORT.ACTIONS.TYPE.CHANGE_POLICY)) {
        lastMessageTextFromReport = getPolicyChangeMessage(lastReportAction);
    } else if (isActionOfType(lastReportAction, CONST.REPORT.ACTIONS.TYPE.TRAVEL_UPDATE)) {
        lastMessageTextFromReport = getTravelUpdateMessage(lastReportAction);
    } else if (isRenamedAction(lastReportAction)) {
        lastMessageTextFromReport = getRenamedAction(lastReportAction, isExpenseReport(report));
    } else if (isActionOfType(lastReportAction, CONST.REPORT.ACTIONS.TYPE.DELETED_TRANSACTION)) {
        lastMessageTextFromReport = getDeletedTransactionMessage(lastReportAction);
    }

    // we do not want to show report closed in LHN for non archived report so use getReportLastMessage as fallback instead of lastMessageText from report
    if (
        reportID &&
        !isReportArchived &&
        (report.lastActionType === CONST.REPORT.ACTIONS.TYPE.CLOSED || (lastOriginalReportAction?.reportActionID && isDeletedAction(lastOriginalReportAction)))
    ) {
        return lastMessageTextFromReport || (getReportLastMessage(reportID).lastMessageText ?? '');
    }

    // When the last report action has unknown mentions (@Hidden), we want to consistently show @Hidden in LHN and report screen
    // so we reconstruct the last message text of the report from the last report action.
    if (!lastMessageTextFromReport && lastReportAction && hasHiddenDisplayNames(getMentionedAccountIDsFromAction(lastReportAction))) {
        lastMessageTextFromReport = Parser.htmlToText(getReportActionHtml(lastReportAction));
    }

    // If the last report action is a pending moderation action, get the last message text from the last visible report action
    if (reportID && !lastMessageTextFromReport && isPendingRemove(lastOriginalReportAction)) {
        lastMessageTextFromReport = getReportActionMessageText(lastReportAction);
    }

    if (reportID && !lastMessageTextFromReport && lastReportAction) {
        const chatReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.chatReportID}`];
        // If the report is a one-transaction report, get the last message text from combined report actions so the LHN can display modifications to the transaction thread or the report itself
        const transactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, allSortedReportActions[reportID]);
        if (transactionThreadReportID) {
            lastMessageTextFromReport = getReportActionMessageText(lastReportAction);
        }
    }

    // If the last action is AddComment and no last message text was determined yet, use getLastVisibleMessage to get the preview text
    if (reportID && !lastMessageTextFromReport && isAddCommentAction(lastReportAction)) {
        lastMessageTextFromReport = lastVisibleMessage?.lastMessageText;
    }

    return lastMessageTextFromReport || (report?.lastMessageText ?? '');
}

/**
 * Creates a report list option
 */
function createOption(
    accountIDs: number[],
    personalDetails: OnyxInputOrEntry<PersonalDetailsList>,
    report: OnyxInputOrEntry<Report>,
    config?: PreviewConfig,
    reportAttributesDerived?: ReportAttributesDerivedValue['reports'],
): OptionData {
    const {showChatPreviewLine = false, forcePolicyNamePreview = false, showPersonalDetails = false, selected, isSelected, isDisabled} = config ?? {};
    const result: OptionData = {
        text: undefined,
        alternateText: undefined,
        pendingAction: undefined,
        allReportErrors: undefined,
        brickRoadIndicator: null,
        icons: undefined,
        tooltipText: null,
        ownerAccountID: undefined,
        subtitle: undefined,
        participantsList: undefined,
        accountID: 0,
        login: undefined,
        reportID: '',
        phoneNumber: undefined,
        hasDraftComment: false,
        keyForList: undefined,
        isDefaultRoom: false,
        isPinned: false,
        isWaitingOnBankAccount: false,
        iouReportID: undefined,
        isIOUReportOwner: null,
        iouReportAmount: 0,
        isChatRoom: false,
        shouldShowSubscript: false,
        isPolicyExpenseChat: false,
        isOwnPolicyExpenseChat: false,
        isExpenseReport: false,
        policyID: undefined,
        isOptimisticPersonalDetail: false,
        lastMessageText: '',
        lastVisibleActionCreated: undefined,
        selected,
        isSelected,
        isDisabled,
    };

    const personalDetailMap = getPersonalDetailsForAccountIDs(accountIDs, personalDetails);
    const personalDetailList = Object.values(personalDetailMap).filter((details): details is PersonalDetails => !!details);
    const personalDetail = personalDetailList.at(0);
    let hasMultipleParticipants = personalDetailList.length > 1;
    let subtitle;
    let reportName;
    result.participantsList = personalDetailList;
    result.isOptimisticPersonalDetail = personalDetail?.isOptimisticPersonalDetail;
    if (report) {
        const reportNameValuePairs = allReportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report.reportID}`];
        result.isChatRoom = reportUtilsIsChatRoom(report);
        result.isDefaultRoom = isDefaultRoom(report);
        result.private_isArchived = reportNameValuePairs?.private_isArchived;
        result.isExpenseReport = isExpenseReport(report);
        result.isInvoiceRoom = isInvoiceRoom(report);
        result.isMoneyRequestReport = reportUtilsIsMoneyRequestReport(report);
        result.isThread = isChatThread(report);
        result.isTaskReport = reportUtilsIsTaskReport(report);
        result.shouldShowSubscript = shouldReportShowSubscript(report, !!result.private_isArchived);
        result.isPolicyExpenseChat = reportUtilsIsPolicyExpenseChat(report);
        result.isOwnPolicyExpenseChat = report.isOwnPolicyExpenseChat ?? false;
        result.allReportErrors = reportAttributesDerived?.[report.reportID]?.reportErrors ?? {};
        result.brickRoadIndicator = !isEmptyObject(result.allReportErrors) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : '';
        result.pendingAction = report.pendingFields ? (report.pendingFields.addWorkspaceRoom ?? report.pendingFields.createChat) : undefined;
        result.ownerAccountID = report.ownerAccountID;
        result.reportID = report.reportID;
        const chatReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report.chatReportID}`];
        const oneTransactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.reportID}`]);
        const oneTransactionThreadReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${oneTransactionThreadReportID}`];
        result.isUnread = isUnread(report, oneTransactionThreadReport);
        result.isPinned = report.isPinned;
        result.iouReportID = report.iouReportID;
        result.keyForList = String(report.reportID);
        result.isWaitingOnBankAccount = report.isWaitingOnBankAccount;
        result.policyID = report.policyID;
        result.policyName = getPolicyName({report, returnEmptyIfNotFound: true});
        result.isSelfDM = reportUtilsIsSelfDM(report);
        result.notificationPreference = getReportNotificationPreference(report);
        result.lastVisibleActionCreated = report.lastVisibleActionCreated;

        const visibleParticipantAccountIDs = getParticipantsAccountIDsForDisplay(report, true);

        result.tooltipText = getReportParticipantsTitle(visibleParticipantAccountIDs);

        hasMultipleParticipants = personalDetailList.length > 1 || result.isChatRoom || result.isPolicyExpenseChat || reportUtilsIsGroupChat(report);
        subtitle = getChatRoomSubtitle(report, {isCreateExpenseFlow: true});

        const lastAction = lastVisibleReportActions[report.reportID];
        // lastActorAccountID can be an empty string
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        const lastActorAccountID = lastAction?.actorAccountID || report.lastActorAccountID;
        const lastActorDetails = lastActorAccountID ? (personalDetails?.[lastActorAccountID] ?? null) : null;
        const lastActorDisplayName = getLastActorDisplayName(lastActorDetails);
        const lastMessageTextFromReport = getLastMessageTextForReport(report, lastActorDetails, undefined, !!result.private_isArchived);
        let lastMessageText = lastMessageTextFromReport;

        const shouldDisplayLastActorName =
            lastAction &&
            lastAction.actionName !== CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW &&
            lastAction.actionName !== CONST.REPORT.ACTIONS.TYPE.IOU &&
            !isArchivedNonExpenseReport(report, !!reportNameValuePairs?.private_isArchived) &&
            shouldShowLastActorDisplayName(report, lastActorDetails, lastAction);
        if (shouldDisplayLastActorName && lastActorDisplayName && lastMessageTextFromReport) {
            lastMessageText = `${lastActorDisplayName}: ${lastMessageTextFromReport}`;
        }

        result.lastMessageText = lastMessageText;

        // If displaying chat preview line is needed, let's overwrite the default alternate text
        result.alternateText = showPersonalDetails && personalDetail?.login ? personalDetail.login : getAlternateText(result, {showChatPreviewLine, forcePolicyNamePreview});

        reportName = showPersonalDetails ? getDisplayNameForParticipant({accountID: accountIDs.at(0)}) || formatPhoneNumber(personalDetail?.login ?? '') : getReportName(report);
    } else {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        reportName = getDisplayNameForParticipant({accountID: accountIDs.at(0)}) || formatPhoneNumber(personalDetail?.login ?? '');
        result.keyForList = String(accountIDs.at(0));

        result.alternateText = formatPhoneNumber(personalDetails?.[accountIDs[0]]?.login ?? '');
    }

    result.isIOUReportOwner = isIOUOwnedByCurrentUser(result);
    result.iouReportAmount = getMoneyRequestSpendBreakdown(result).totalDisplaySpend;

    if (!hasMultipleParticipants && (!report || (report && !reportUtilsIsGroupChat(report) && !reportUtilsIsChatRoom(report)))) {
        result.login = personalDetail?.login;
        result.accountID = Number(personalDetail?.accountID);
        result.phoneNumber = personalDetail?.phoneNumber;
    }

    result.text = reportName;
    result.icons = getIcons(report, personalDetails, personalDetail?.avatar, personalDetail?.login, personalDetail?.accountID, null);
    result.subtitle = subtitle;

    return result;
}

/**
 * Get the option for a given report.
 */
function getReportOption(participant: Participant, reportAttributesDerived?: ReportAttributesDerivedValue['reports']): OptionData {
    const report = getReportOrDraftReport(participant.reportID);
    const visibleParticipantAccountIDs = getParticipantsAccountIDsForDisplay(report, true);

    const option = createOption(
        visibleParticipantAccountIDs,
        allPersonalDetails ?? {},
        !isEmptyObject(report) ? report : undefined,
        {
            showChatPreviewLine: false,
            forcePolicyNamePreview: false,
        },
        reportAttributesDerived,
    );

    // Update text & alternateText because createOption returns workspace name only if report is owned by the user
    if (option.isSelfDM) {
        option.alternateText = translateLocal('reportActionsView.yourSpace');
    } else if (option.isInvoiceRoom) {
        option.text = getReportName(report);
        option.alternateText = translateLocal('workspace.common.invoices');
    } else {
        option.text = getPolicyName({report});
        option.alternateText = translateLocal('workspace.common.workspace');

        if (report?.policyID) {
            const policy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report.policyID}`];
            const submitToAccountID = getSubmitToAccountID(policy, report);
            const submitsToAccountDetails = allPersonalDetails?.[submitToAccountID];
            const subtitle = submitsToAccountDetails?.displayName ?? submitsToAccountDetails?.login;

            if (subtitle) {
                option.alternateText = translateLocal('iou.submitsTo', {name: subtitle ?? ''});
            }
        }
    }
    option.isDisabled = isDraftReport(participant.reportID);
    option.selected = participant.selected;
    option.isSelected = participant.selected;
    option.brickRoadIndicator = null;
    return option;
}

/**
 * Get the display option for a given report.
 */
function getReportDisplayOption(report: OnyxEntry<Report>, unknownUserDetails: OnyxEntry<Participant>, reportAttributesDerived?: ReportAttributesDerivedValue['reports']): OptionData {
    const visibleParticipantAccountIDs = getParticipantsAccountIDsForDisplay(report, true);

    const option = createOption(
        visibleParticipantAccountIDs,
        allPersonalDetails ?? {},
        !isEmptyObject(report) ? report : undefined,
        {
            showChatPreviewLine: false,
            forcePolicyNamePreview: false,
        },
        reportAttributesDerived,
    );

    // Update text & alternateText because createOption returns workspace name only if report is owned by the user
    if (option.isSelfDM) {
        option.alternateText = translateLocal('reportActionsView.yourSpace');
    } else if (option.isInvoiceRoom) {
        option.text = getReportName(report);
        option.alternateText = translateLocal('workspace.common.invoices');
    } else if (unknownUserDetails && !option.text) {
        option.text = unknownUserDetails.text ?? unknownUserDetails.login;
        option.alternateText = unknownUserDetails.login;
        option.participantsList = [{...unknownUserDetails, displayName: unknownUserDetails.login, accountID: unknownUserDetails.accountID ?? CONST.DEFAULT_NUMBER_ID}];
    } else if (report?.ownerAccountID !== 0 || !option.text) {
        option.text = getPolicyName({report});
        option.alternateText = translateLocal('workspace.common.workspace');
    }
    option.isDisabled = true;
    option.selected = false;
    option.isSelected = false;

    return option;
}
/**
 * Get the option for a policy expense report.
 */
function getPolicyExpenseReportOption(participant: Participant | OptionData, reportAttributesDerived?: ReportAttributesDerivedValue['reports']): OptionData {
    const expenseReport = reportUtilsIsPolicyExpenseChat(participant) ? getReportOrDraftReport(participant.reportID) : null;

    const visibleParticipantAccountIDs = Object.entries(expenseReport?.participants ?? {})
        .filter(([, reportParticipant]) => reportParticipant && !isHiddenForCurrentUser(reportParticipant.notificationPreference))
        .map(([accountID]) => Number(accountID));

    const option = createOption(
        visibleParticipantAccountIDs,
        allPersonalDetails ?? {},
        !isEmptyObject(expenseReport) ? expenseReport : null,
        {
            showChatPreviewLine: false,
            forcePolicyNamePreview: false,
        },
        reportAttributesDerived,
    );

    // Update text & alternateText because createOption returns workspace name only if report is owned by the user
    option.text = getPolicyName({report: expenseReport});
    option.alternateText = translateLocal('workspace.common.workspace');
    option.selected = participant.selected;
    option.isSelected = participant.selected;
    return option;
}

/**
 * Checks if the given userDetails is currentUser or not.
 * Note: We can't migrate this off of using logins because this is used to check if you're trying to start a chat with
 * yourself or a different user, and people won't be starting new chats via accountID usually.
 */
function isCurrentUser(userDetails: PersonalDetails): boolean {
    if (!userDetails) {
        return false;
    }

    // If user login is a mobile number, append sms domain if not appended already.
    const userDetailsLogin = addSMSDomainIfPhoneNumber(userDetails.login ?? '');

    if (currentUserLogin?.toLowerCase() === userDetailsLogin.toLowerCase()) {
        return true;
    }

    // Check if userDetails login exists in loginList
    return Object.keys(loginList ?? {}).some((login) => login.toLowerCase() === userDetailsLogin.toLowerCase());
}

function isDisablingOrDeletingLastEnabledCategory(
    policy: Policy | undefined,
    policyCategories: PolicyCategories | undefined,
    selectedCategories: Array<PolicyCategory | undefined>,
): boolean {
    const enabledCategoriesCount = getEnabledCategoriesCount(policyCategories);

    if (!enabledCategoriesCount) {
        return false;
    }

    if (policy?.requiresCategory && selectedCategories.filter((selectedCategory) => selectedCategory?.enabled).length === enabledCategoriesCount) {
        return true;
    }

    return false;
}

function isDisablingOrDeletingLastEnabledTag(policyTagList: PolicyTagList | undefined, selectedTags: Array<PolicyTag | undefined>): boolean {
    const enabledTagsCount = getCountOfEnabledTagsOfList(policyTagList?.tags);

    if (!enabledTagsCount) {
        return false;
    }

    if (policyTagList?.required && selectedTags.filter((selectedTag) => selectedTag?.enabled).length === enabledTagsCount) {
        return true;
    }
    return false;
}

function isMakingLastRequiredTagListOptional(policy: Policy | undefined, policyTags: PolicyTagLists | undefined, selectedTagLists: Array<PolicyTagList | undefined>): boolean {
    const requiredTagsCount = getCountOfRequiredTagLists(policyTags);

    if (!requiredTagsCount) {
        return false;
    }

    if (policy?.requiresTag && selectedTagLists.filter((selectedTagList) => selectedTagList?.required).length === requiredTagsCount) {
        return true;
    }
    return false;
}

function getSearchValueForPhoneOrEmail(searchTerm: string) {
    const parsedPhoneNumber = parsePhoneNumber(appendCountryCode(Str.removeSMSDomain(searchTerm)));
    return parsedPhoneNumber.possible ? (parsedPhoneNumber.number?.e164 ?? '') : searchTerm.toLowerCase();
}

/**
 * Verifies that there is at least one enabled option
 */
function hasEnabledOptions(options: PolicyCategories | PolicyTag[]): boolean {
    return Object.values(options).some((option: PolicyTag | PolicyCategory) => option.enabled && option.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE);
}

/**
 * Checks if a report option is selected based on matching accountID or reportID.
 *
 * @param reportOption - The report option to be checked.
 * @param selectedOptions - Array of selected options to compare with.
 * @returns true if the report option matches any of the selected options by accountID or reportID, false otherwise.
 */
function isReportSelected(reportOption: OptionData, selectedOptions: Array<Partial<OptionData>>) {
    if (!selectedOptions || selectedOptions.length === 0) {
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    return selectedOptions.some((option) => (option.accountID && option.accountID === reportOption.accountID) || (option.reportID && option.reportID === reportOption.reportID));
}

function processReport(
    report: OnyxEntry<Report>,
    personalDetails: OnyxEntry<PersonalDetailsList>,
    reportAttributesDerived?: ReportAttributesDerivedValue['reports'],
): {
    reportMapEntry?: [number, Report]; // The entry to add to reportMapForAccountIDs if applicable
    reportOption: SearchOption<Report> | null; // The report option to add to allReportOptions if applicable
} {
    if (!report) {
        return {reportOption: null};
    }

    const isOneOnOneChat = reportUtilsIsOneOnOneChat(report);
    const accountIDs = getParticipantsAccountIDsForDisplay(report);
    const isChatRoom = reportUtilsIsChatRoom(report);

    if ((!accountIDs || accountIDs.length === 0) && !isChatRoom) {
        return {reportOption: null};
    }

    // Determine if this report should be mapped to a personal detail
    const reportMapEntry = accountIDs.length <= 1 && isOneOnOneChat ? ([accountIDs.at(0), report] as [number, Report]) : undefined;

    return {
        reportMapEntry,
        reportOption: {
            item: report,
            ...createOption(accountIDs, personalDetails, report, undefined, reportAttributesDerived),
        },
    };
}

function createOptionList(personalDetails: OnyxEntry<PersonalDetailsList>, reports?: OnyxCollection<Report>, reportAttributesDerived?: ReportAttributesDerivedValue['reports']) {
    const reportMapForAccountIDs: Record<number, Report> = {};
    const allReportOptions: Array<SearchOption<Report>> = [];

    if (reports) {
        Object.values(reports).forEach((report) => {
            const {reportMapEntry, reportOption} = processReport(report, personalDetails, reportAttributesDerived);

            if (reportMapEntry) {
                const [accountID, reportValue] = reportMapEntry;
                reportMapForAccountIDs[accountID] = reportValue;
            }

            if (reportOption) {
                allReportOptions.push(reportOption);
            }
        });
    }

    const allPersonalDetailsOptions = Object.values(personalDetails ?? {}).map((personalDetail) => ({
        item: personalDetail,
        ...createOption(
            [personalDetail?.accountID ?? CONST.DEFAULT_NUMBER_ID],
            personalDetails,
            reportMapForAccountIDs[personalDetail?.accountID ?? CONST.DEFAULT_NUMBER_ID],
            {
                showPersonalDetails: true,
            },
            reportAttributesDerived,
        ),
    }));

    return {
        reports: allReportOptions,
        personalDetails: allPersonalDetailsOptions as Array<SearchOption<PersonalDetails>>,
    };
}

function createOptionFromReport(report: Report, personalDetails: OnyxEntry<PersonalDetailsList>, reportAttributesDerived?: ReportAttributesDerivedValue['reports']) {
    const accountIDs = getParticipantsAccountIDsForDisplay(report);

    return {
        item: report,
        ...createOption(accountIDs, personalDetails, report, undefined, reportAttributesDerived),
    };
}

function orderPersonalDetailsOptions(options: OptionData[]) {
    // PersonalDetails should be ordered Alphabetically by default - https://github.com/Expensify/App/issues/8220#issuecomment-1104009435
    return lodashOrderBy(options, [(personalDetail) => personalDetail.text?.toLowerCase()], 'asc');
}

/**
 * Orders report options without grouping them by kind.
 * Usually used when there is no search value
 */
function orderReportOptions(options: OptionData[]) {
    return lodashOrderBy(options, [sortComparatorReportOptionByArchivedStatus, sortComparatorReportOptionByDate], ['asc', 'desc']);
}

/**
 * Sort personal details by displayName or login in alphabetical order
 */
const personalDetailsComparator = (personalDetail: OptionData) => {
    const name = personalDetail.text ?? personalDetail.alternateText ?? personalDetail.login ?? '';
    return name.toLowerCase();
};

/**
 * Sort reports by archived status and last visible action
 */
const recentReportComparator = (option: OptionData) => {
    return `${option.private_isArchived ? 0 : 1}_${option.lastVisibleActionCreated ?? ''}`;
};

/**
 * Sort options by a given comparator and return first sorted options.
 * Function uses a min heap to efficiently get the first sorted options.
 */
function optionsOrderBy<T = OptionData>(options: T[], comparator: (option: T) => number | string, limit?: number, filter?: (option: T) => boolean | undefined, reversed = false): T[] {
    Timing.start(CONST.TIMING.SEARCH_MOST_RECENT_OPTIONS);
    const heap = reversed ? new MaxHeap<T>(comparator) : new MinHeap<T>(comparator);
    options.forEach((option) => {
        if (filter && !filter(option)) {
            return;
        }
        if (limit && heap.size() >= limit) {
            const peekedValue = heap.peek();
            if (!peekedValue) {
                throw new Error('Heap is empty, cannot peek value');
            }
            if (comparator(option) > comparator(peekedValue)) {
                heap.pop();
                heap.push(option);
            }
        } else {
            heap.push(option);
        }
    });
    Timing.end(CONST.TIMING.SEARCH_MOST_RECENT_OPTIONS);
    return [...heap].reverse();
}

/**
 * Ordering for report options when you have a search value, will order them by kind additionally.
 * @param options - list of options to be sorted
 * @param searchValue - search string
 * @returns a sorted list of options
 */
function orderReportOptionsWithSearch(
    options: OptionData[],
    searchValue: string,
    {preferChatRoomsOverThreads = false, preferPolicyExpenseChat = false, preferRecentExpenseReports = false}: OrderReportOptionsConfig = {},
) {
    const orderedByDate = orderReportOptions(options);

    return lodashOrderBy(
        orderedByDate,
        [
            // Sorting by kind:
            (option) => {
                if (option.isPolicyExpenseChat && preferPolicyExpenseChat && option.policyID === activePolicyID) {
                    return 0;
                }

                if (option.isSelfDM) {
                    return -1;
                }
                if (preferRecentExpenseReports && !!option?.lastIOUCreationDate) {
                    return 1;
                }
                if (preferRecentExpenseReports && option.isPolicyExpenseChat) {
                    return 1;
                }
                if (preferChatRoomsOverThreads && option.isThread) {
                    return 4;
                }
                if (!!option.isChatRoom || option.private_isArchived) {
                    return 3;
                }
                if (!option.login) {
                    return 2;
                }
                if (option.login.toLowerCase() !== searchValue?.toLowerCase()) {
                    return 1;
                }

                // When option.login is an exact match with the search value, returning 0 puts it at the top of the option list
                return 0;
            },
            // For Submit Expense flow, prioritize the most recent expense reports and then policy expense chats (without expense requests)
            preferRecentExpenseReports ? (option) => option?.lastIOUCreationDate ?? '' : '',
            preferRecentExpenseReports ? (option) => option?.isPolicyExpenseChat : 0,
        ],
        ['asc', 'desc', 'desc'],
    );
}

function orderWorkspaceOptions(options: OptionData[]): OptionData[] {
    return options.sort((a, b) => {
        // Check if `a` is the default workspace
        if (a.isPolicyExpenseChat && a.policyID === activePolicyID) {
            return -1;
        }

        // Check if `b` is the default workspace
        if (b.isPolicyExpenseChat && b.policyID === activePolicyID) {
            return 1;
        }

        return 0;
    });
}

function sortComparatorReportOptionByArchivedStatus(option: OptionData) {
    return option.private_isArchived ? 1 : 0;
}

function sortComparatorReportOptionByDate(options: OptionData) {
    // If there is no date (ie. a personal detail option), the option will be sorted to the bottom
    // (comparing a dateString > '' returns true, and we are sorting descending, so the dateString will come before '')
    return options.lastVisibleActionCreated ?? '';
}

/**
 * Sorts reports and personal details independently.
 */
function orderOptions(options: ReportAndPersonalDetailOptions): ReportAndPersonalDetailOptions;

/**
 * Sorts reports and personal details independently, but prioritizes the search value.
 */
function orderOptions(options: ReportAndPersonalDetailOptions, searchValue: string, config?: OrderReportOptionsConfig): ReportAndPersonalDetailOptions;
function orderOptions(options: ReportAndPersonalDetailOptions, searchValue?: string, config?: OrderReportOptionsConfig): ReportAndPersonalDetailOptions {
    let orderedReportOptions: OptionData[];
    if (searchValue) {
        orderedReportOptions = orderReportOptionsWithSearch(options.recentReports, searchValue, config);
    } else {
        orderedReportOptions = orderReportOptions(options.recentReports);
    }
    const orderedPersonalDetailsOptions = orderPersonalDetailsOptions(options.personalDetails);
    const orderedWorkspaceChats = orderWorkspaceOptions(options?.workspaceChats ?? []);

    return {
        recentReports: orderedReportOptions,
        personalDetails: orderedPersonalDetailsOptions,
        workspaceChats: orderedWorkspaceChats,
    };
}

function canCreateOptimisticPersonalDetailOption({
    recentReportOptions,
    personalDetailsOptions,
    currentUserOption,
    searchValue,
}: {
    recentReportOptions: OptionData[];
    personalDetailsOptions: OptionData[];
    currentUserOption?: OptionData | null;
    searchValue: string;
}) {
    if (recentReportOptions.length + personalDetailsOptions.length > 0) {
        return false;
    }
    if (!currentUserOption) {
        return true;
    }
    return currentUserOption.login !== addSMSDomainIfPhoneNumber(searchValue ?? '').toLowerCase() && currentUserOption.login !== searchValue?.toLowerCase();
}

/**
 * We create a new user option if the following conditions are satisfied:
 * - There's no matching recent report and personal detail option
 * - The searchValue is a valid email or phone number
 * - If prop shouldAcceptName = true, the searchValue can be also a normal string
 * - The searchValue isn't the current personal detail login
 */
function getUserToInviteOption({searchValue, loginsToExclude = {}, selectedOptions = [], showChatPreviewLine = false, shouldAcceptName = false}: GetUserToInviteConfig): OptionData | null {
    if (!searchValue) {
        return null;
    }

    const parsedPhoneNumber = parsePhoneNumber(appendCountryCode(Str.removeSMSDomain(searchValue)));
    const isCurrentUserLogin = isCurrentUser({login: searchValue} as PersonalDetails);
    const isInSelectedOption = selectedOptions.some((option) => 'login' in option && option.login === searchValue);
    const isValidEmail = Str.isValidEmail(searchValue) && !Str.isDomainEmail(searchValue) && !Str.endsWith(searchValue, CONST.SMS.DOMAIN);
    const isValidPhoneNumber = parsedPhoneNumber.possible && Str.isValidE164Phone(getPhoneNumberWithoutSpecialChars(parsedPhoneNumber.number?.input ?? ''));
    const isInOptionToExclude = loginsToExclude[addSMSDomainIfPhoneNumber(searchValue).toLowerCase()];

    if (isCurrentUserLogin || isInSelectedOption || (!isValidEmail && !isValidPhoneNumber && !shouldAcceptName) || isInOptionToExclude) {
        return null;
    }

    // Generates an optimistic account ID for new users not yet saved in Onyx
    const optimisticAccountID = generateAccountID(searchValue);
    const personalDetailsExtended = {
        ...allPersonalDetails,
        [optimisticAccountID]: {
            accountID: optimisticAccountID,
            login: searchValue,
        },
    };
    const userToInvite = createOption([optimisticAccountID], personalDetailsExtended, null, {
        showChatPreviewLine,
    });
    userToInvite.isOptimisticAccount = true;
    userToInvite.login = isValidEmail || isValidPhoneNumber ? searchValue : '';
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    userToInvite.text = userToInvite.text || searchValue;
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    userToInvite.alternateText = userToInvite.alternateText || searchValue;

    // If user doesn't exist, use a fallback avatar
    userToInvite.icons = [
        {
            source: FallbackAvatar,
            id: optimisticAccountID,
            name: searchValue,
            type: CONST.ICON_TYPE_AVATAR,
        },
    ];

    return userToInvite;
}

function getUserToInviteContactOption({
    searchValue = '',
    optionsToExclude = [],
    selectedOptions = [],
    firstName = '',
    lastName = '',
    email = '',
    phone = '',
    avatar = '',
}: GetUserToInviteConfig): SearchOption<PersonalDetails> | null {
    // If email is provided, use it as the primary identifier
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const effectiveSearchValue = email || searchValue;

    // Handle phone number parsing for either provided phone or searchValue
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const phoneToCheck = phone || searchValue;
    const parsedPhoneNumber = parsePhoneNumber(appendCountryCode(Str.removeSMSDomain(phoneToCheck)));

    const isCurrentUserLogin = isCurrentUser({login: effectiveSearchValue} as PersonalDetails);
    const isInSelectedOption = selectedOptions.some((option) => 'login' in option && option.login === effectiveSearchValue);

    // Validate email (either provided email or searchValue)
    const isValidEmail = Str.isValidEmail(effectiveSearchValue) && !Str.isDomainEmail(effectiveSearchValue) && !Str.endsWith(effectiveSearchValue, CONST.SMS.DOMAIN);

    const isValidPhoneNumber = parsedPhoneNumber.possible && Str.isValidE164Phone(getPhoneNumberWithoutSpecialChars(parsedPhoneNumber.number?.input ?? ''));

    const isInOptionToExclude =
        optionsToExclude.findIndex((optionToExclude) => 'login' in optionToExclude && optionToExclude.login === addSMSDomainIfPhoneNumber(effectiveSearchValue).toLowerCase()) !== -1;

    if (!effectiveSearchValue || isCurrentUserLogin || isInSelectedOption || (!isValidEmail && !isValidPhoneNumber) || isInOptionToExclude) {
        return null;
    }

    // Generates an optimistic account ID for new users not yet saved in Onyx
    const optimisticAccountID = generateAccountID(effectiveSearchValue);

    // Construct display name if firstName/lastName are provided
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const displayName = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || effectiveSearchValue;

    // Create the base user details that will be used in both item and participantsList
    const userDetails = {
        accountID: optimisticAccountID,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        avatar: avatar || FallbackAvatar,
        firstName: firstName ?? '',
        lastName: lastName ?? '',
        displayName,
        login: effectiveSearchValue,
        pronouns: '',
        phoneNumber: phone ?? '',
        validated: true,
    };

    const userToInvite = {
        item: userDetails,
        text: displayName,
        alternateText: displayName !== effectiveSearchValue ? effectiveSearchValue : undefined,
        brickRoadIndicator: null,
        icons: [
            {
                source: userDetails.avatar,
                type: CONST.ICON_TYPE_AVATAR,
                name: effectiveSearchValue,
                id: optimisticAccountID,
            },
        ],
        tooltipText: null,
        participantsList: [userDetails],
        accountID: optimisticAccountID,
        login: effectiveSearchValue,
        reportID: '',
        phoneNumber: phone ?? '',
        hasDraftComment: false,
        keyForList: optimisticAccountID.toString(),
        isDefaultRoom: false,
        isPinned: false,
        isWaitingOnBankAccount: false,
        isIOUReportOwner: false,
        iouReportAmount: 0,
        isChatRoom: false,
        shouldShowSubscript: false,
        isPolicyExpenseChat: false,
        isOwnPolicyExpenseChat: false,
        isExpenseReport: false,
        lastMessageText: '',
        isBold: true,
        isOptimisticAccount: true,
    };

    return userToInvite;
}

function isValidReport(reportOption: SearchOption<Report>, config: GetValidReportsConfig): boolean {
    const {
        betas = [],
        includeMultipleParticipantReports = false,
        includeOwnedWorkspaceChats = false,
        includeThreads = false,
        includeTasks = false,
        includeMoneyRequests = false,
        includeReadOnly = true,
        transactionViolations = {},
        includeSelfDM = false,
        includeInvoiceRooms = false,
        action,
        includeP2P = true,
        includeDomainEmail = false,
        loginsToExclude = {},
        excludeNonAdminWorkspaces,
    } = config;
    const topmostReportId = Navigation.getTopmostReportId();

    // eslint-disable-next-line rulesdir/prefer-at
    const option = reportOption;
    const report = reportOption.item;
    const chatReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${option.chatReportID}`];
    const doesReportHaveViolations = shouldDisplayViolationsRBRInLHN(report, transactionViolations);

    const shouldBeInOptionList = shouldReportBeInOptionList({
        report,
        chatReport,
        currentReportId: topmostReportId,
        betas,
        doesReportHaveViolations,
        isInFocusMode: false,
        excludeEmptyChats: false,
        includeSelfDM,
        login: option.login,
        includeDomainEmail,
        isReportArchived: !!option.private_isArchived,
    });

    if (!shouldBeInOptionList) {
        return false;
    }

    const isThread = option.isThread;
    const isTaskReport = option.isTaskReport;
    const isPolicyExpenseChat = option.isPolicyExpenseChat;
    const isMoneyRequestReport = option.isMoneyRequestReport;
    const isSelfDM = option.isSelfDM;
    const isChatRoom = option.isChatRoom;
    const accountIDs = getParticipantsAccountIDsForDisplay(report);

    if (excludeNonAdminWorkspaces && !isPolicyAdmin(option.policyID, policies)) {
        return false;
    }

    if (isPolicyExpenseChat && report?.isOwnPolicyExpenseChat && !includeOwnedWorkspaceChats) {
        return false;
    }
    // When passing includeP2P false we are trying to hide features from users that are not ready for P2P and limited to expense chats only.
    if (!includeP2P && !isPolicyExpenseChat) {
        return false;
    }

    if (isSelfDM && !includeSelfDM) {
        return false;
    }

    if (isThread && !includeThreads) {
        return false;
    }

    if (isTaskReport && !includeTasks) {
        return false;
    }

    if (isMoneyRequestReport && !includeMoneyRequests) {
        return false;
    }

    if (!canUserPerformWriteAction(report) && !includeReadOnly) {
        return false;
    }

    // In case user needs to add credit bank account, don't allow them to submit an expense from the workspace.
    if (includeOwnedWorkspaceChats && hasIOUWaitingOnCurrentUserBankAccount(report)) {
        return false;
    }

    if ((!accountIDs || accountIDs.length === 0) && !isChatRoom) {
        return false;
    }

    if (option.login === CONST.EMAIL.NOTIFICATIONS) {
        return false;
    }
    const isCurrentUserOwnedPolicyExpenseChatThatCouldShow =
        option.isPolicyExpenseChat && option.ownerAccountID === currentUserAccountID && includeOwnedWorkspaceChats && !option.private_isArchived;

    const shouldShowInvoiceRoom =
        includeInvoiceRooms && isInvoiceRoom(report) && isPolicyAdmin(option.policyID, policies) && !option.private_isArchived && canSendInvoiceFromWorkspace(report.policyID);

    /*
    Exclude the report option if it doesn't meet any of the following conditions:
    - It is not an owned policy expense chat that could be shown
    - Multiple participant reports are not included
    - It doesn't have a login
    - It is not an invoice room that should be shown
    */
    if (!isCurrentUserOwnedPolicyExpenseChatThatCouldShow && !includeMultipleParticipantReports && !option.login && !shouldShowInvoiceRoom) {
        return false;
    }

    // If we're excluding threads, check the report to see if it has a single participant and if the participant is already selected
    if (!includeThreads && ((!!option.login && loginsToExclude[option.login]) || loginsToExclude[option.reportID])) {
        return false;
    }

    if (action === CONST.IOU.ACTION.CATEGORIZE) {
        const reportPolicy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${option.policyID}`];
        if (!reportPolicy?.areCategoriesEnabled) {
            return false;
        }
    }
    return true;
}

function getValidReports(reports: OptionList['reports'], config: GetValidReportsConfig): GetValidReportsReturnTypeCombined {
    const {
        showChatPreviewLine = false,
        forcePolicyNamePreview = false,
        action,
        selectedOptions = [],
        shouldBoldTitleByDefault = true,
        shouldSeparateSelfDMChat,
        shouldSeparateWorkspaceChat,
        isPerDiemRequest = false,
        showRBR = true,
    } = config;

    const validReportOptions: OptionData[] = [];
    const workspaceChats: OptionData[] = [];
    let selfDMChat: OptionData | undefined;
    const preferRecentExpenseReports = action === CONST.IOU.ACTION.CREATE;

    for (let i = 0; i < reports.length; i++) {
        // eslint-disable-next-line rulesdir/prefer-at
        const option = reports[i];
        const report = option.item;

        /**
         * By default, generated options does not have the chat preview line enabled.
         * If showChatPreviewLine or forcePolicyNamePreview are true, let's generate and overwrite the alternate text.
         */
        const alternateText = getAlternateText(option, {showChatPreviewLine, forcePolicyNamePreview});
        const isSelected = isReportSelected(option, selectedOptions);
        const isBold = shouldBoldTitleByDefault || shouldUseBoldText(option);
        let lastIOUCreationDate;

        // Add a field to sort the recent reports by the time of last IOU request for create actions
        if (preferRecentExpenseReports) {
            const reportPreviewAction = allSortedReportActions[option.reportID]?.find((reportAction) => isActionOfType(reportAction, CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW));

            if (reportPreviewAction) {
                const iouReportID = getIOUReportIDFromReportActionPreview(reportPreviewAction);
                const iouReportActions = iouReportID ? (allSortedReportActions[iouReportID] ?? []) : [];
                const lastIOUAction = iouReportActions.find((iouAction) => iouAction.actionName === CONST.REPORT.ACTIONS.TYPE.IOU);
                if (lastIOUAction) {
                    lastIOUCreationDate = lastIOUAction.lastModified;
                }
            }
        }

        const newReportOption = {
            ...option,
            alternateText,
            isSelected,
            isBold,
            lastIOUCreationDate,
            brickRoadIndicator: showRBR ? option.brickRoadIndicator : null,
        };

        if (shouldSeparateWorkspaceChat && newReportOption.isOwnPolicyExpenseChat && !newReportOption.private_isArchived) {
            newReportOption.text = getPolicyName({report});
            newReportOption.alternateText = translateLocal('workspace.common.workspace');
            if (report?.policyID) {
                const policy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report.policyID}`];
                const submitToAccountID = getSubmitToAccountID(policy, report);
                const submitsToAccountDetails = allPersonalDetails?.[submitToAccountID];
                const subtitle = submitsToAccountDetails?.displayName ?? submitsToAccountDetails?.login;

                if (subtitle) {
                    newReportOption.alternateText = translateLocal('iou.submitsTo', {name: subtitle ?? ''});
                }
                const canSubmitPerDiemExpense = canSubmitPerDiemExpenseFromWorkspace(policy);
                if (!canSubmitPerDiemExpense && isPerDiemRequest) {
                    continue;
                }
            }
            workspaceChats.push(newReportOption);
        } else if (shouldSeparateSelfDMChat && newReportOption.isSelfDM) {
            selfDMChat = newReportOption;
        } else {
            validReportOptions.push(newReportOption);
        }
    }

    return {
        recentReports: validReportOptions,
        workspaceOptions: workspaceChats,
        selfDMOption: selfDMChat,
    };
}

/**
 * Whether user submitted already an expense or scanned receipt
 */
function getIsUserSubmittedExpenseOrScannedReceipt(): boolean {
    return !!nvpDismissedProductTraining?.[CONST.PRODUCT_TRAINING_TOOLTIP_NAMES.SCAN_TEST_TOOLTIP];
}

/**
 * Whether the report is a Manager McTest report
 */
function isManagerMcTestReport(report: SearchOption<Report>): boolean {
    return report.participantsList?.some((participant) => participant.accountID === CONST.ACCOUNT_ID.MANAGER_MCTEST) ?? false;
}

/**
 * Returns a list of logins that should be restricted (i.e., hidden or excluded in the UI)
 * based on dynamic business logic and feature flags.
 * Centralizes restriction logic to avoid scattering conditions across the codebase.
 */
function getRestrictedLogins(config: GetOptionsConfig, options: OptionList, canShowManagerMcTest: boolean): Record<string, boolean> {
    const userHasReportWithManagerMcTest = Object.values(options.reports).some((report) => isManagerMcTestReport(report));
    return {
        [CONST.EMAIL.MANAGER_MCTEST]:
            !canShowManagerMcTest ||
            (getIsUserSubmittedExpenseOrScannedReceipt() && !userHasReportWithManagerMcTest) ||
            !Permissions.isBetaEnabled(CONST.BETAS.NEWDOT_MANAGER_MCTEST, config.betas) ||
            isUserInvitedToWorkspace(),
    };
}

/**
 * Options are reports and personal details. This function filters out the options that are not valid to be displayed.
 */
function getValidOptions(
    options: OptionList,
    {
        excludeLogins = {},
        includeSelectedOptions = false,
        includeRecentReports = true,
        recentAttendees,
        selectedOptions = [],
        shouldSeparateSelfDMChat = false,
        shouldSeparateWorkspaceChat = false,
        excludeHiddenThreads = false,
        canShowManagerMcTest = false,
        searchString,
        maxElements,
        includeUserToInvite = false,
        ...config
    }: GetOptionsConfig = {},
): Options {
    const restrictedLogins = getRestrictedLogins(config, options, canShowManagerMcTest);

    // Gather shared configs:
    const loginsToExclude: Record<string, boolean> = {
        [CONST.EMAIL.NOTIFICATIONS]: true,
        ...excludeLogins,
        ...restrictedLogins,
    };
    // If we're including selected options from the search results, we only want to exclude them if the search input is empty
    // This is because on certain pages, we show the selected options at the top when the search input is empty
    // This prevents the issue of seeing the selected option twice if you have them as a recent chat and select them
    if (!includeSelectedOptions) {
        selectedOptions.forEach((option) => {
            if (!option.login) {
                return;
            }
            loginsToExclude[option.login] = true;
        });
    }
    const {includeP2P = true, shouldBoldTitleByDefault = true, includeDomainEmail = false, ...getValidReportsConfig} = config;

    let filteredReports = options.reports;

    // Get valid recent reports:
    let recentReportOptions: OptionData[] = [];
    let workspaceChats: OptionData[] = [];
    let selfDMChat: OptionData | undefined;

    if (includeRecentReports) {
        // if maxElements is passed, filter the recent reports by searchString and return only most recent reports (@see recentReportsComparator)
        const searchTerms = deburr(searchString ?? '')
            .toLowerCase()
            .split(' ')
            .filter((term) => term.length > 0);

        const filteringFunction = (report: SearchOption<Report>) => {
            let searchText = `${report.text ?? ''}${report.login ?? ''}`;

            if (report.isThread) {
                searchText += report.alternateText ?? '';
            } else if (report.isChatRoom) {
                searchText += report.subtitle ?? '';
            } else if (report.isPolicyExpenseChat) {
                searchText += `${report.subtitle ?? ''}${report.policyName ?? ''}`;
            }
            searchText = deburr(searchText.toLocaleLowerCase());
            const searchTermsFound = searchTerms.length > 0 ? searchTerms.every((term) => searchText.includes(term)) : true;

            if (!searchTermsFound) {
                return false;
            }

            return isValidReport(report, {
                ...getValidReportsConfig,
                includeP2P,
                includeDomainEmail,
                selectedOptions,
                loginsToExclude,
                shouldBoldTitleByDefault,
                shouldSeparateSelfDMChat,
                shouldSeparateWorkspaceChat,
            });
        };

        filteredReports = optionsOrderBy(options.reports, recentReportComparator, maxElements, filteringFunction);

        const {recentReports, workspaceOptions, selfDMOption} = getValidReports(filteredReports, {
            ...getValidReportsConfig,
            selectedOptions,
            loginsToExclude,
            shouldBoldTitleByDefault,
            shouldSeparateSelfDMChat,
            shouldSeparateWorkspaceChat,
        });

        recentReportOptions = recentReports;
        workspaceChats = workspaceOptions;
        selfDMChat = selfDMOption;
    } else if (recentAttendees && recentAttendees?.length > 0) {
        recentAttendees.filter((attendee) => {
            const login = attendee.login ?? attendee.displayName;
            if (login) {
                loginsToExclude[login] = true;
                return true;
            }

            return false;
        });
        recentReportOptions = recentAttendees as OptionData[];
    }

    // Get valid personal details and check if we can find the current user:
    let personalDetailsOptions: OptionData[] = [];
    const currentUserRef = {
        current: undefined as OptionData | undefined,
    };

    if (includeP2P) {
        let personalDetailLoginsToExclude = loginsToExclude;
        if (currentUserLogin) {
            personalDetailLoginsToExclude = {
                ...loginsToExclude,
                [currentUserLogin]: !config.includeCurrentUser,
            };
        }

        const searchTerms = deburr(searchString ?? '')
            .toLowerCase()
            .split(' ')
            .filter((term) => term.length > 0);
        const filteringFunction = (personalDetail: OptionData) => {
            if (
                !personalDetail?.login ||
                !personalDetail.accountID ||
                !!personalDetail?.isOptimisticPersonalDetail ||
                (!includeDomainEmail && Str.isDomainEmail(personalDetail.login)) ||
                // Exclude the setup specialist from the list of personal details as it's a fallback if guide is not assigned
                personalDetail?.login === CONST.SETUP_SPECIALIST_LOGIN
            ) {
                return false;
            }
            if (personalDetailLoginsToExclude[personalDetail.login]) {
                return false;
            }
            const searchText = deburr(`${personalDetail.text ?? ''} ${personalDetail.login ?? ''}`.toLocaleLowerCase());

            return searchTerms.length > 0 ? searchTerms.every((term) => searchText.includes(term)) : true;
        };

        personalDetailsOptions = optionsOrderBy(options.personalDetails, personalDetailsComparator, maxElements, filteringFunction, true);

        for (let i = 0; i < personalDetailsOptions.length; i++) {
            const personalDetail = personalDetailsOptions.at(i);
            if (!personalDetail) {
                continue;
            }
            if (!!currentUserLogin && personalDetail?.login === currentUserLogin) {
                currentUserRef.current = personalDetail;
            }
            personalDetail.isBold = shouldBoldTitleByDefault;
        }
    }

    if (excludeHiddenThreads) {
        recentReportOptions = recentReportOptions.filter((option) => !option.isThread || option.notificationPreference !== CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN);
    }

    let userToInvite: OptionData | null = null;
    if (includeUserToInvite) {
        userToInvite = filterUserToInvite({currentUserOption: currentUserRef.current, recentReports: recentReportOptions, personalDetails: personalDetailsOptions}, searchString ?? '');
    }

    return {
        personalDetails: personalDetailsOptions,
        recentReports: recentReportOptions,
        currentUserOption: currentUserRef.current,
        userToInvite,
        workspaceChats,
        selfDMChat,
    };
}

/**
 * Build the options for the Search view
 */
function getSearchOptions(
    options: OptionList,
    betas: Beta[] = [],
    isUsedInChatFinder = true,
    includeReadOnly = true,
    searchQuery = '',
    maxResults?: number,
    includeUserToInvite?: boolean,
    includeRecentReports = true,
): Options {
    Timing.start(CONST.TIMING.LOAD_SEARCH_OPTIONS);
    Performance.markStart(CONST.TIMING.LOAD_SEARCH_OPTIONS);
    const optionList = getValidOptions(options, {
        betas,
        includeRecentReports,
        includeMultipleParticipantReports: true,
        showChatPreviewLine: isUsedInChatFinder,
        includeP2P: true,
        includeOwnedWorkspaceChats: true,
        includeThreads: true,
        includeMoneyRequests: true,
        includeTasks: true,
        includeReadOnly,
        includeSelfDM: true,
        shouldBoldTitleByDefault: !isUsedInChatFinder,
        excludeHiddenThreads: true,
        maxElements: maxResults,
        searchString: searchQuery,
        includeUserToInvite,
    });

    Timing.end(CONST.TIMING.LOAD_SEARCH_OPTIONS);
    Performance.markEnd(CONST.TIMING.LOAD_SEARCH_OPTIONS);

    return optionList;
}

function getShareLogOptions(options: OptionList, betas: Beta[] = []): Options {
    return getValidOptions(options, {
        betas,
        includeMultipleParticipantReports: true,
        includeP2P: true,
        forcePolicyNamePreview: true,
        includeOwnedWorkspaceChats: true,
        includeSelfDM: true,
        includeThreads: true,
        includeReadOnly: false,
    });
}

/**
 * Build the IOUConfirmation options for showing the payee personalDetail
 */
function getIOUConfirmationOptionsFromPayeePersonalDetail(personalDetail: OnyxEntry<PersonalDetails>, amountText?: string): PayeePersonalDetails {
    const login = personalDetail?.login ?? '';
    return {
        text: formatPhoneNumber(getDisplayNameOrDefault(personalDetail, login)),
        alternateText: formatPhoneNumber(login || getDisplayNameOrDefault(personalDetail, '', false)),
        icons: [
            {
                source: personalDetail?.avatar ?? FallbackAvatar,
                name: personalDetail?.login ?? '',
                type: CONST.ICON_TYPE_AVATAR,
                id: personalDetail?.accountID,
            },
        ],
        descriptiveText: amountText ?? '',
        login: personalDetail?.login ?? '',
        accountID: personalDetail?.accountID ?? CONST.DEFAULT_NUMBER_ID,
        keyForList: String(personalDetail?.accountID ?? CONST.DEFAULT_NUMBER_ID),
        isInteractive: false,
    };
}

function getAttendeeOptions(
    reports: Array<SearchOption<Report>>,
    personalDetails: Array<SearchOption<PersonalDetails>>,
    betas: OnyxEntry<Beta[]>,
    attendees: Attendee[],
    recentAttendees: Attendee[],
    includeOwnedWorkspaceChats = false,
    includeP2P = true,
    includeInvoiceRooms = false,
    action: IOUAction | undefined = undefined,
) {
    const personalDetailList = keyBy(
        personalDetails.map(({item}) => item),
        'accountID',
    );

    const recentAttendeeHasCurrentUser = recentAttendees.find((attendee) => attendee.email === currentUserLogin || attendee.login === currentUserLogin);
    if (!recentAttendeeHasCurrentUser && currentUserLogin) {
        const details = getPersonalDetailByEmail(currentUserLogin);
        recentAttendees.push({
            email: currentUserLogin,
            login: currentUserLogin,
            displayName: details?.displayName ?? currentUserLogin,
            accountID: currentUserAccountID,
            text: details?.displayName ?? currentUserLogin,
            searchText: details?.displayName ?? currentUserLogin,
            avatarUrl: details?.avatarThumbnail ?? '',
        });
    }

    const filteredRecentAttendees = recentAttendees
        .filter((attendee) => !attendees.find(({email, displayName}) => (attendee.email ? email === attendee.email : displayName === attendee.displayName)))
        .map((attendee) => ({
            ...attendee,
            login: attendee.email ?? attendee.displayName,
            ...getPersonalDetailByEmail(attendee.email),
        }))
        .map((attendee) => getParticipantsOption(attendee, personalDetailList as never));

    return getValidOptions(
        {reports, personalDetails},
        {
            betas,
            selectedOptions: attendees.map((attendee) => ({...attendee, login: attendee.email})),
            excludeLogins: CONST.EXPENSIFY_EMAILS_OBJECT,
            includeOwnedWorkspaceChats,
            includeRecentReports: false,
            includeP2P,
            includeSelectedOptions: false,
            includeSelfDM: false,
            includeInvoiceRooms,
            action,
            recentAttendees: filteredRecentAttendees,
        },
    );
}

/**
 * Build the options for the Share Destination for a Task
 */

function getShareDestinationOptions(
    reports: Array<SearchOption<Report>> = [],
    personalDetails: Array<SearchOption<PersonalDetails>> = [],
    betas: OnyxEntry<Beta[]> = [],
    selectedOptions: Array<Partial<OptionData>> = [],
    excludeLogins: Record<string, boolean> = {},
    includeOwnedWorkspaceChats = true,
) {
    return getValidOptions(
        {reports, personalDetails},
        {
            betas,
            selectedOptions,
            includeMultipleParticipantReports: true,
            showChatPreviewLine: true,
            forcePolicyNamePreview: true,
            includeThreads: true,
            includeMoneyRequests: true,
            includeTasks: true,
            excludeLogins,
            includeOwnedWorkspaceChats,
            includeSelfDM: true,
        },
    );
}

/**
 * Format personalDetails or userToInvite to be shown in the list
 *
 * @param member - personalDetails or userToInvite
 * @param config - keys to overwrite the default values
 */
function formatMemberForList(member: OptionData): MemberForList {
    const accountID = member.accountID;

    return {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        text: member.text || member.displayName || '',
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        alternateText: member.alternateText || member.login || '',
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        keyForList: member.keyForList || String(accountID ?? CONST.DEFAULT_NUMBER_ID) || '',
        isSelected: member.isSelected ?? false,
        isDisabled: member.isDisabled ?? false,
        accountID,
        login: member.login ?? '',
        icons: member.icons,
        pendingAction: member.pendingAction,
        reportID: member.reportID,
    };
}

/**
 * Build the options for the Workspace Member Invite view
 */
function getMemberInviteOptions(
    personalDetails: Array<SearchOption<PersonalDetails>>,
    betas: Beta[] = [],
    excludeLogins: Record<string, boolean> = {},
    includeSelectedOptions = false,
    reports: Array<SearchOption<Report>> = [],
    includeRecentReports = false,
): Options {
    const options = getValidOptions(
        {reports, personalDetails},
        {
            betas,
            includeP2P: true,
            excludeLogins,
            includeSelectedOptions,
            includeRecentReports,
        },
    );

    const orderedOptions = orderOptions(options);
    return {
        ...options,
        personalDetails: orderedOptions.personalDetails,
        recentReports: orderedOptions.recentReports,
    };
}

/**
 * Helper method that returns the text to be used for the header's message and title (if any)
 */
function getHeaderMessage(hasSelectableOptions: boolean, hasUserToInvite: boolean, searchValue: string, hasMatchedParticipant = false): string {
    const isValidPhone = parsePhoneNumber(appendCountryCode(searchValue)).possible;

    const isValidEmail = Str.isValidEmail(searchValue);

    if (searchValue && CONST.REGEX.DIGITS_AND_PLUS.test(searchValue) && !isValidPhone && !hasSelectableOptions) {
        return translateLocal('messages.errorMessageInvalidPhone');
    }

    // Without a search value, it would be very confusing to see a search validation message.
    // Therefore, this skips the validation when there is no search value.
    if (searchValue && !hasSelectableOptions && !hasUserToInvite) {
        if (/^\d+$/.test(searchValue) && !isValidPhone) {
            return translateLocal('messages.errorMessageInvalidPhone');
        }
        if (/@/.test(searchValue) && !isValidEmail) {
            return translateLocal('messages.errorMessageInvalidEmail');
        }
        if (hasMatchedParticipant && (isValidEmail || isValidPhone)) {
            return '';
        }
        return translateLocal('common.noResultsFound');
    }

    return '';
}

/**
 * Helper method for non-user lists (eg. categories and tags) that returns the text to be used for the header's message and title (if any)
 */
function getHeaderMessageForNonUserList(hasSelectableOptions: boolean, searchValue: string): string {
    if (searchValue && !hasSelectableOptions) {
        return translateLocal('common.noResultsFound');
    }
    return '';
}

/**
 * Helper method to check whether an option can show tooltip or not
 */
function shouldOptionShowTooltip(option: OptionData): boolean {
    return !option.private_isArchived;
}

/**
 * Handles the logic for displaying selected participants from the search term
 */
function formatSectionsFromSearchTerm(
    searchTerm: string,
    selectedOptions: OptionData[],
    filteredRecentReports: OptionData[],
    filteredPersonalDetails: OptionData[],
    personalDetails: OnyxEntry<PersonalDetailsList> = {},
    shouldGetOptionDetails = false,
    filteredWorkspaceChats: OptionData[] = [],
    reportAttributesDerived?: ReportAttributesDerivedValue['reports'],
): SectionForSearchTerm {
    // We show the selected participants at the top of the list when there is no search term or maximum number of participants has already been selected
    // However, if there is a search term we remove the selected participants from the top of the list unless they are part of the search results
    // This clears up space on mobile views, where if you create a group with 4+ people you can't see the selected participants and the search results at the same time
    if (searchTerm === '') {
        return {
            section: {
                title: undefined,
                data: shouldGetOptionDetails
                    ? selectedOptions.map((participant) => {
                          const isReportPolicyExpenseChat = participant.isPolicyExpenseChat ?? false;
                          return isReportPolicyExpenseChat ? getPolicyExpenseReportOption(participant, reportAttributesDerived) : getParticipantsOption(participant, personalDetails);
                      })
                    : selectedOptions,
                shouldShow: selectedOptions.length > 0,
            },
        };
    }

    const cleanSearchTerm = searchTerm.trim().toLowerCase();
    // If you select a new user you don't have a contact for, they won't get returned as part of a recent report or personal details
    // This will add them to the list of options, deduping them if they already exist in the other lists
    const selectedParticipantsWithoutDetails = selectedOptions.filter((participant) => {
        const accountID = participant.accountID ?? null;
        const isPartOfSearchTerm = getPersonalDetailSearchTerms(participant).join(' ').toLowerCase().includes(cleanSearchTerm);
        const isReportInRecentReports = filteredRecentReports.some((report) => report.accountID === accountID) || filteredWorkspaceChats.some((report) => report.accountID === accountID);
        const isReportInPersonalDetails = filteredPersonalDetails.some((personalDetail) => personalDetail.accountID === accountID);

        return isPartOfSearchTerm && !isReportInRecentReports && !isReportInPersonalDetails;
    });

    return {
        section: {
            title: undefined,
            data: shouldGetOptionDetails
                ? selectedParticipantsWithoutDetails.map((participant) => {
                      const isReportPolicyExpenseChat = participant.isPolicyExpenseChat ?? false;
                      return isReportPolicyExpenseChat ? getPolicyExpenseReportOption(participant, reportAttributesDerived) : getParticipantsOption(participant, personalDetails);
                  })
                : selectedParticipantsWithoutDetails,
            shouldShow: selectedParticipantsWithoutDetails.length > 0,
        },
    };
}

/**
 * Helper method to get the `keyForList` for the first option in the OptionsList
 */
function getFirstKeyForList(data?: Option[] | null) {
    if (!data?.length) {
        return '';
    }

    const firstNonEmptyDataObj = data.at(0);

    return firstNonEmptyDataObj?.keyForList ? firstNonEmptyDataObj?.keyForList : '';
}

function getPersonalDetailSearchTerms(item: Partial<OptionData>) {
    return [item.participantsList?.[0]?.displayName ?? '', item.login ?? '', item.login?.replace(CONST.EMAIL_SEARCH_REGEX, '') ?? ''];
}

function getCurrentUserSearchTerms(item: OptionData) {
    return [item.text ?? '', item.login ?? '', item.login?.replace(CONST.EMAIL_SEARCH_REGEX, '') ?? ''];
}

/**
 * Remove the personal details for the DMs that are already in the recent reports so that we don't show duplicates.
 */
function filteredPersonalDetailsOfRecentReports(recentReports: OptionData[], personalDetails: OptionData[]) {
    const excludedLogins = new Set(recentReports.map((report) => report.login));
    return personalDetails.filter((personalDetail) => !excludedLogins.has(personalDetail.login));
}

/**
 * Filters options based on the search input value
 */
function filterReports(reports: OptionData[], searchTerms: string[]): OptionData[] {
    const normalizedSearchTerms = searchTerms.map((term) => StringUtils.normalizeAccents(term));
    // We search eventually for multiple whitespace separated search terms.
    // We start with the search term at the end, and then narrow down those filtered search results with the next search term.
    // We repeat (reduce) this until all search terms have been used:
    const filteredReports = normalizedSearchTerms.reduceRight(
        (items, term) =>
            filterArrayByMatch(items, term, (item) => {
                const values: string[] = [];
                if (item.text) {
                    values.push(StringUtils.normalizeAccents(item.text));
                    values.push(StringUtils.normalizeAccents(item.text).replace(/['-]/g, ''));
                }

                if (item.login) {
                    values.push(StringUtils.normalizeAccents(item.login));
                    values.push(StringUtils.normalizeAccents(item.login.replace(CONST.EMAIL_SEARCH_REGEX, '')));
                }

                if (item.isThread) {
                    if (item.alternateText) {
                        values.push(StringUtils.normalizeAccents(item.alternateText));
                    }
                } else if (!!item.isChatRoom || !!item.isPolicyExpenseChat) {
                    if (item.subtitle) {
                        values.push(StringUtils.normalizeAccents(item.subtitle));
                    }
                }

                return uniqFast(values);
            }),
        // We start from all unfiltered reports:
        reports,
    );

    return filteredReports;
}

function filterWorkspaceChats(reports: OptionData[], searchTerms: string[]): OptionData[] {
    const filteredReports = searchTerms.reduceRight(
        (items, term) =>
            filterArrayByMatch(items, term, (item) => {
                const values: string[] = [];
                if (item.text) {
                    values.push(item.text);
                }
                return uniqFast(values);
            }),
        // We start from all unfiltered reports:
        reports,
    );

    return filteredReports;
}

function filterPersonalDetails(personalDetails: OptionData[], searchTerms: string[]): OptionData[] {
    return searchTerms.reduceRight(
        (items, term) =>
            filterArrayByMatch(items, term, (item) => {
                const values = getPersonalDetailSearchTerms(item);
                return uniqFast(values);
            }),
        personalDetails,
    );
}

function filterCurrentUserOption(currentUserOption: OptionData | null | undefined, searchTerms: string[]): OptionData | null | undefined {
    return searchTerms.reduceRight((item, term) => {
        if (!item) {
            return null;
        }

        const currentUserOptionSearchText = uniqFast(getCurrentUserSearchTerms(item)).join(' ');
        return isSearchStringMatch(term, currentUserOptionSearchText) ? item : null;
    }, currentUserOption);
}

function filterUserToInvite(options: Omit<Options, 'userToInvite'>, searchValue: string, config?: FilterUserToInviteConfig): OptionData | null {
    const {canInviteUser = true, excludeLogins = {}} = config ?? {};
    if (!canInviteUser) {
        return null;
    }

    const canCreateOptimisticDetail = canCreateOptimisticPersonalDetailOption({
        recentReportOptions: options.recentReports,
        personalDetailsOptions: options.personalDetails,
        currentUserOption: options.currentUserOption,
        searchValue,
    });

    if (!canCreateOptimisticDetail) {
        return null;
    }

    const loginsToExclude: Record<string, boolean> = {
        [CONST.EMAIL.NOTIFICATIONS]: true,
        ...excludeLogins,
    };
    return getUserToInviteOption({
        searchValue,
        loginsToExclude,
        ...config,
    });
}

function filterSelfDMChat(report: OptionData, searchTerms: string[]): OptionData | undefined {
    const isMatch = searchTerms.every((term) => {
        const values: string[] = [];

        if (report.text) {
            values.push(report.text);
        }
        if (report.login) {
            values.push(report.login);
            values.push(report.login.replace(CONST.EMAIL_SEARCH_REGEX, ''));
        }
        if (report.isThread) {
            if (report.alternateText) {
                values.push(report.alternateText);
            }
        } else if (!!report.isChatRoom || !!report.isPolicyExpenseChat) {
            if (report.subtitle) {
                values.push(report.subtitle);
            }
        }

        // Remove duplicate values and check if the term matches any value
        return uniqFast(values).some((value) => value.includes(term));
    });

    return isMatch ? report : undefined;
}

function filterOptions(options: Options, searchInputValue: string, config?: FilterUserToInviteConfig): Options {
    const parsedPhoneNumber = parsePhoneNumber(appendCountryCode(Str.removeSMSDomain(searchInputValue)));
    const searchValue = parsedPhoneNumber.possible && parsedPhoneNumber.number?.e164 ? parsedPhoneNumber.number.e164 : searchInputValue.toLowerCase();
    const searchTerms = searchValue ? searchValue.split(' ') : [];

    const recentReports = filterReports(options.recentReports, searchTerms);
    const personalDetails = filterPersonalDetails(options.personalDetails, searchTerms);
    const currentUserOption = filterCurrentUserOption(options.currentUserOption, searchTerms);
    const userToInvite = filterUserToInvite(
        {
            recentReports,
            personalDetails,
            currentUserOption,
        },
        searchValue,
        config,
    );
    const workspaceChats = filterWorkspaceChats(options.workspaceChats ?? [], searchTerms);

    const selfDMChat = options.selfDMChat ? filterSelfDMChat(options.selfDMChat, searchTerms) : undefined;

    return {
        personalDetails,
        recentReports,
        userToInvite,
        currentUserOption,
        workspaceChats,
        selfDMChat,
    };
}

type AllOrderConfigs = OrderReportOptionsConfig & OrderOptionsConfig;
type FilterAndOrderConfig = FilterUserToInviteConfig & AllOrderConfigs;

/**
 * Orders the reports and personal details based on the search input value.
 * Personal details will be filtered out if they are part of the recent reports.
 * Additional configs can be applied.
 */
function combineOrderingOfReportsAndPersonalDetails(
    options: ReportAndPersonalDetailOptions,
    searchInputValue: string,
    {maxRecentReportsToShow, sortByReportTypeInSearch, ...orderReportOptionsConfig}: AllOrderConfigs = {},
): ReportAndPersonalDetailOptions {
    // sortByReportTypeInSearch will show the personal details as part of the recent reports
    if (sortByReportTypeInSearch) {
        const personalDetailsWithoutDMs = filteredPersonalDetailsOfRecentReports(options.recentReports, options.personalDetails);
        const reportsAndPersonalDetails = options.recentReports.concat(personalDetailsWithoutDMs);
        return orderOptions({recentReports: reportsAndPersonalDetails, personalDetails: []}, searchInputValue, orderReportOptionsConfig);
    }

    let orderedReports = orderReportOptionsWithSearch(options.recentReports, searchInputValue, orderReportOptionsConfig);
    if (typeof maxRecentReportsToShow === 'number') {
        orderedReports = orderedReports.slice(0, maxRecentReportsToShow);
    }

    const personalDetailsWithoutDMs = filteredPersonalDetailsOfRecentReports(orderedReports, options.personalDetails);
    const orderedPersonalDetails = orderPersonalDetailsOptions(personalDetailsWithoutDMs);

    return {
        recentReports: orderedReports,
        personalDetails: orderedPersonalDetails,
    };
}

/**
 * Filters and orders the options based on the search input value.
 * Note that personal details that are part of the recent reports will always be shown as part of the recent reports (ie. DMs).
 */
function filterAndOrderOptions(options: Options, searchInputValue: string, config: FilterAndOrderConfig = {}): Options {
    let filterResult = options;
    if (searchInputValue.trim().length > 0) {
        filterResult = filterOptions(options, searchInputValue, config);
    }

    const orderedOptions = combineOrderingOfReportsAndPersonalDetails(filterResult, searchInputValue, config);

    // on staging server, in specific cases (see issue) BE returns duplicated personalDetails entries
    const uniqueLogins = new Set<string>();
    orderedOptions.personalDetails = orderedOptions.personalDetails.filter((detail) => {
        const login = detail.login ?? '';
        if (uniqueLogins.has(login)) {
            return false;
        }
        uniqueLogins.add(login);
        return true;
    });

    return {
        ...filterResult,
        ...orderedOptions,
    };
}

/**
 * Filter out selected options from personal details and recent reports
 * @param options - The options to filter
 * @param selectedOptions - The selected options to filter out.
 * @returns The filtered options
 */
function filterSelectedOptions(options: Options, selectedOptions: Set<number | undefined>): Options {
    const filteredOptions = {
        ...options,
        personalDetails: options.personalDetails.filter(({accountID}) => !selectedOptions.has(accountID)),
        recentReports: options.recentReports.filter(({accountID}) => !selectedOptions.has(accountID)),
    };
    return filteredOptions;
}

function sortAlphabetically<T extends Partial<Record<TKey, string | undefined>>, TKey extends keyof T>(items: T[], key: TKey): T[] {
    return items.sort((a, b) => localeCompare(a[key]?.toLowerCase() ?? '', b[key]?.toLowerCase() ?? ''));
}

function getEmptyOptions(): Options {
    return {
        recentReports: [],
        personalDetails: [],
        userToInvite: null,
        currentUserOption: null,
    };
}

function shouldUseBoldText(report: OptionData): boolean {
    const notificationPreference = report.notificationPreference ?? getReportNotificationPreference(report);
    return report.isUnread === true && notificationPreference !== CONST.REPORT.NOTIFICATION_PREFERENCE.MUTE && !isHiddenForCurrentUser(notificationPreference);
}

function getManagerMcTestParticipant(): Participant | undefined {
    const managerMcTestPersonalDetails = Object.values(allPersonalDetails ?? {}).find((personalDetails) => personalDetails?.login === CONST.EMAIL.MANAGER_MCTEST);
    const managerMcTestReport =
        managerMcTestPersonalDetails?.accountID && currentUserAccountID ? getChatByParticipants([managerMcTestPersonalDetails?.accountID, currentUserAccountID]) : undefined;
    return managerMcTestPersonalDetails ? {...getParticipantsOption(managerMcTestPersonalDetails, allPersonalDetails), reportID: managerMcTestReport?.reportID} : undefined;
}

function shallowOptionsListCompare(a: OptionList, b: OptionList): boolean {
    if (!a || !b) {
        return false;
    }
    if (a.reports.length !== b.reports.length || a.personalDetails.length !== b.personalDetails.length) {
        return false;
    }
    for (let i = 0; i < a.reports.length; i++) {
        if (a.reports.at(i)?.reportID !== b.reports.at(i)?.reportID) {
            return false;
        }
    }
    for (let i = 0; i < a.personalDetails.length; i++) {
        if (a.personalDetails.at(i)?.login !== b.personalDetails.at(i)?.login) {
            return false;
        }
    }
    return true;
}

export {
    canCreateOptimisticPersonalDetailOption,
    combineOrderingOfReportsAndPersonalDetails,
    createOptionFromReport,
    createOptionList,
    filterAndOrderOptions,
    filterOptions,
    filterReports,
    filterSelectedOptions,
    filterSelfDMChat,
    filterUserToInvite,
    filterWorkspaceChats,
    filteredPersonalDetailsOfRecentReports,
    formatMemberForList,
    formatSectionsFromSearchTerm,
    getAlternateText,
    getAttendeeOptions,
    getAvatarsForAccountIDs,
    getCurrentUserSearchTerms,
    getEmptyOptions,
    getFirstKeyForList,
    getHeaderMessage,
    getHeaderMessageForNonUserList,
    getIOUConfirmationOptionsFromPayeePersonalDetail,
    getIOUReportIDOfLastAction,
    getIsUserSubmittedExpenseOrScannedReceipt,
    getLastActorDisplayName,
    getLastMessageTextForReport,
    getManagerMcTestParticipant,
    getMemberInviteOptions,
    getParticipantsOption,
    getPersonalDetailSearchTerms,
    getPersonalDetailsForAccountIDs,
    getPolicyExpenseReportOption,
    getReportDisplayOption,
    getReportOption,
    getSearchOptions,
    getSearchValueForPhoneOrEmail,
    getShareDestinationOptions,
    getShareLogOptions,
    getUserToInviteContactOption,
    getUserToInviteOption,
    getValidOptions,
    hasEnabledOptions,
    isCurrentUser,
    isDisablingOrDeletingLastEnabledCategory,
    isDisablingOrDeletingLastEnabledTag,
    isMakingLastRequiredTagListOptional,
    isPersonalDetailsReady,
    isSearchStringMatch,
    isSearchStringMatchUserDetails,
    optionsOrderBy,
    orderOptions,
    orderPersonalDetailsOptions,
    orderReportOptions,
    orderReportOptionsWithSearch,
    orderWorkspaceOptions,
    processReport,
    recentReportComparator,
    shallowOptionsListCompare,
    shouldOptionShowTooltip,
    shouldShowLastActorDisplayName,
    shouldUseBoldText,
    sortAlphabetically,
};

export type {MemberForList, Option, OptionList, OptionTree, Options, ReportAndPersonalDetailOptions, SearchOption, Section, SectionBase};
