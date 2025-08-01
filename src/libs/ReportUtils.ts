import {findFocusedRoute} from '@react-navigation/native';
import {format} from 'date-fns';
import {Str} from 'expensify-common';
import {deepEqual} from 'fast-equals';
import lodashEscape from 'lodash/escape';
import lodashIntersection from 'lodash/intersection';
import isEmpty from 'lodash/isEmpty';
import isNumber from 'lodash/isNumber';
import mapValues from 'lodash/mapValues';
import lodashMaxBy from 'lodash/maxBy';
import type {OnyxCollection, OnyxEntry, OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import type {SvgProps} from 'react-native-svg';
import type {OriginalMessageChangePolicy, OriginalMessageExportIntegration, OriginalMessageModifiedExpense} from 'src/types/onyx/OriginalMessage';
import type {SetRequired, TupleToUnion, ValueOf} from 'type-fest';
import {FallbackAvatar, IntacctSquare, NetSuiteExport, NetSuiteSquare, QBDSquare, QBOExport, QBOSquare, SageIntacctExport, XeroExport, XeroSquare} from '@components/Icon/Expensicons';
import * as defaultGroupAvatars from '@components/Icon/GroupDefaultAvatars';
import * as defaultWorkspaceAvatars from '@components/Icon/WorkspaceDefaultAvatars';
import type {MoneyRequestAmountInputProps} from '@components/MoneyRequestAmountInput';
import type {FileObject} from '@pages/media/AttachmentModalScreen/types';
import type {IOUAction, IOUType, OnboardingAccounting} from '@src/CONST';
import CONST from '@src/CONST';
import type {ParentNavigationSummaryParams} from '@src/languages/params';
import type {TranslationPaths} from '@src/languages/types';
import NAVIGATORS from '@src/NAVIGATORS';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type {
    Beta,
    IntroSelected,
    NewGroupChatDraft,
    OnyxInputOrEntry,
    PersonalDetails,
    PersonalDetailsList,
    Policy,
    PolicyCategories,
    PolicyCategory,
    PolicyReportField,
    PolicyTagLists,
    Report,
    ReportAction,
    ReportAttributesDerivedValue,
    ReportMetadata,
    ReportNameValuePairs,
    ReportViolationName,
    ReportViolations,
    Session,
    Task,
    Transaction,
    TransactionViolation,
    TransactionViolations,
    UserWallet,
} from '@src/types/onyx';
import type {Attendee, Participant} from '@src/types/onyx/IOU';
import type {SelectedParticipant} from '@src/types/onyx/NewGroupChatDraft';
import type {OriginalMessageExportedToIntegration} from '@src/types/onyx/OldDotAction';
import type Onboarding from '@src/types/onyx/Onboarding';
import type {ErrorFields, Errors, Icon, PendingAction} from '@src/types/onyx/OnyxCommon';
import type {OriginalMessageChangeLog, PaymentMethodType} from '@src/types/onyx/OriginalMessage';
import type {Status} from '@src/types/onyx/PersonalDetails';
import type {AllConnectionName, ConnectionName} from '@src/types/onyx/Policy';
import type {InvoiceReceiverType, NotificationPreference, Participants, Participant as ReportParticipant} from '@src/types/onyx/Report';
import type {Message, OldDotReportAction, ReportActions} from '@src/types/onyx/ReportAction';
import type {PendingChatMember} from '@src/types/onyx/ReportMetadata';
import type {OnyxData} from '@src/types/onyx/Request';
import type {SearchPolicy, SearchReport, SearchTransaction} from '@src/types/onyx/SearchResults';
import type {Comment, TransactionChanges, WaypointCollection} from '@src/types/onyx/Transaction';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import type IconAsset from '@src/types/utils/IconAsset';
import {createDraftTransaction, getIOUReportActionToApproveOrPay, setMoneyRequestParticipants, unholdRequest} from './actions/IOU';
import {createDraftWorkspace} from './actions/Policy/Policy';
import {hasCreditBankAccount} from './actions/ReimbursementAccount/store';
import {handleReportChanged} from './actions/Report';
import type {GuidedSetupData, TaskForParameters} from './actions/Report';
import {isAnonymousUser as isAnonymousUserSession} from './actions/Session';
import {getOnboardingMessages} from './actions/Welcome/OnboardingFlow';
import type {OnboardingCompanySize, OnboardingMessage, OnboardingPurpose, OnboardingTaskLinks} from './actions/Welcome/OnboardingFlow';
import type {AddCommentOrAttachmentParams} from './API/parameters';
import {convertToDisplayString} from './CurrencyUtils';
import DateUtils from './DateUtils';
import {hasValidDraftComment} from './DraftCommentUtils';
import {getEnvironment, getEnvironmentURL} from './Environment/Environment';
import type EnvironmentType from './Environment/getEnvironment/types';
import {getMicroSecondOnyxErrorWithTranslationKey, isReceiptError} from './ErrorUtils';
import getAttachmentDetails from './fileDownload/getAttachmentDetails';
import {isReportMessageAttachment} from './isReportMessageAttachment';
import localeCompare from './LocaleCompare';
import {formatPhoneNumber} from './LocalePhoneNumber';
import {translateLocal} from './Localize';
import Log from './Log';
import {isEmailPublicDomain} from './LoginUtils';
// eslint-disable-next-line import/no-cycle
import ModifiedExpenseMessage from './ModifiedExpenseMessage';
import getStateFromPath from './Navigation/helpers/getStateFromPath';
import {isFullScreenName} from './Navigation/helpers/isNavigatorName';
import {linkingConfig} from './Navigation/linkingConfig';
import Navigation, {navigationRef} from './Navigation/Navigation';
import {rand64} from './NumberUtils';
import Parser from './Parser';
import {getParsedMessageWithShortMentions} from './ParsingUtils';
import Permissions from './Permissions';
import {
    getAccountIDsByLogins,
    getDisplayNameOrDefault,
    getEffectiveDisplayName,
    getLoginByAccountID,
    getLoginsByAccountIDs,
    getPersonalDetailByEmail,
    getPersonalDetailsByIDs,
    getShortMentionIfFound,
} from './PersonalDetailsUtils';
import {
    arePaymentsEnabled,
    canSendInvoiceFromWorkspace,
    getActivePolicies,
    getForwardsToAccount,
    getManagerAccountEmail,
    getManagerAccountID,
    getPolicyEmployeeListByIdWithoutCurrentUser,
    getPolicyNameByID,
    getPolicyRole,
    getRuleApprovers,
    getSubmitToAccountID,
    hasDependentTags as hasDependentTagsPolicyUtils,
    isExpensifyTeam,
    isInstantSubmitEnabled,
    isPaidGroupPolicy as isPaidGroupPolicyPolicyUtils,
    isPolicyAdmin as isPolicyAdminPolicyUtils,
    isPolicyAuditor,
    isPolicyMember,
    isPolicyOwner,
    isSubmitAndClose,
    shouldShowPolicy,
} from './PolicyUtils';
import {
    formatLastMessageText,
    getActionableJoinRequestPendingReportAction,
    getAllReportActions,
    getCardIssuedMessage,
    getDismissedViolationMessageText,
    getExportIntegrationLastMessageText,
    getIntegrationSyncFailedMessage,
    getIOUReportIDFromReportActionPreview,
    getJoinRequestMessage,
    getLastClosedReportAction,
    getLastVisibleAction,
    getLastVisibleAction as getLastVisibleActionReportActionsUtils,
    getLastVisibleMessage as getLastVisibleMessageActionUtils,
    getLastVisibleMessage as getLastVisibleMessageReportActionsUtils,
    getMessageOfOldDotReportAction,
    getNumberOfMoneyRequests,
    getOneTransactionThreadReportID,
    getOriginalMessage,
    getPolicyChangeLogDefaultBillableMessage,
    getPolicyChangeLogDefaultTitleEnforcedMessage,
    getPolicyChangeLogMaxExpenseAmountNoReceiptMessage,
    getRenamedAction,
    getReopenedMessage,
    getReportAction,
    getReportActionHtml,
    getReportActionMessage as getReportActionMessageReportUtils,
    getReportActionMessageText,
    getReportActionText,
    getRetractedMessage,
    getTravelUpdateMessage,
    getWorkspaceCurrencyUpdateMessage,
    getWorkspaceFrequencyUpdateMessage,
    getWorkspaceReportFieldAddMessage,
    getWorkspaceReportFieldDeleteMessage,
    getWorkspaceReportFieldUpdateMessage,
    getWorkspaceUpdateFieldMessage,
    isActionableJoinRequest,
    isActionableJoinRequestPending,
    isActionableTrackExpense,
    isActionOfType,
    isApprovedOrSubmittedReportAction,
    isCardIssuedAction,
    isClosedAction,
    isCreatedTaskReportAction,
    isCurrentActionUnread,
    isDeletedAction,
    isDeletedParentAction,
    isExportIntegrationAction,
    isIntegrationMessageAction,
    isMarkAsClosedAction,
    isModifiedExpenseAction,
    isMoneyRequestAction,
    isOldDotReportAction,
    isPendingRemove,
    isPolicyChangeLogAction,
    isReimbursementDeQueuedOrCanceledAction,
    isReimbursementQueuedAction,
    isRenamedAction,
    isReopenedAction,
    isReportActionAttachment,
    isReportPreviewAction,
    isReversedTransaction,
    isRoomChangeLogAction,
    isSentMoneyReportAction,
    isSplitBillAction as isSplitBillReportAction,
    isThreadParentMessage,
    isTrackExpenseAction,
    isTransactionThread,
    isTripPreview,
    isUnapprovedAction,
    isWhisperAction,
    shouldReportActionBeVisible,
    wasActionTakenByCurrentUser,
} from './ReportActionsUtils';
import type {LastVisibleMessage} from './ReportActionsUtils';
import {shouldRestrictUserBillableActions} from './SubscriptionUtils';
import {
    getAttendees,
    getBillable,
    getCardID,
    getCardName,
    getCategory,
    getCurrency,
    getDescription,
    getFormattedCreated,
    getFormattedPostedDate,
    getMCCGroup,
    getMerchant,
    getMerchantOrDescription,
    getOriginalAmount,
    getOriginalCurrency,
    getRateID,
    getRecentTransactions,
    getReimbursable,
    getTag,
    getTaxAmount,
    getTaxCode,
    getAmount as getTransactionAmount,
    getWaypoints,
    hasMissingSmartscanFields as hasMissingSmartscanFieldsTransactionUtils,
    hasNoticeTypeViolation,
    hasReceipt as hasReceiptTransactionUtils,
    hasViolation,
    hasWarningTypeViolation,
    isCardTransaction as isCardTransactionTransactionUtils,
    isDemoTransaction,
    isDistanceRequest,
    isExpensifyCardTransaction,
    isFetchingWaypointsFromServer,
    isOnHold as isOnHoldTransactionUtils,
    isPayAtEndExpense,
    isPending,
    isPerDiemRequest,
    isReceiptBeingScanned,
    isScanning,
    isScanRequest as isScanRequestTransactionUtils,
} from './TransactionUtils';
import {addTrailingForwardSlash} from './Url';
import type {AvatarSource} from './UserUtils';
import {generateAccountID, getDefaultAvatarURL} from './UserUtils';
import ViolationsUtils from './Violations/ViolationsUtils';

// Dynamic Import to avoid circular dependency
const UnreadIndicatorUpdaterHelper = () => import('./UnreadIndicatorUpdater');

type AvatarRange = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

type SpendBreakdown = {
    nonReimbursableSpend: number;
    reimbursableSpend: number;
    totalDisplaySpend: number;
};

type ParticipantDetails = [number, string, AvatarSource, AvatarSource];

type OptimisticAddCommentReportAction = Pick<
    ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT>,
    | 'reportActionID'
    | 'reportID'
    | 'actionName'
    | 'actorAccountID'
    | 'person'
    | 'automatic'
    | 'avatar'
    | 'created'
    | 'message'
    | 'isFirstItem'
    | 'isAttachmentOnly'
    | 'isAttachmentWithText'
    | 'pendingAction'
    | 'shouldShow'
    | 'originalMessage'
    | 'childReportID'
    | 'parentReportID'
    | 'childType'
    | 'childReportName'
    | 'childManagerAccountID'
    | 'childStatusNum'
    | 'childStateNum'
    | 'errors'
    | 'childVisibleActionCount'
    | 'childCommenterCount'
    | 'childLastVisibleActionCreated'
    | 'childOldestFourAccountIDs'
    | 'delegateAccountID'
> & {isOptimisticAction: boolean};

type OptimisticReportAction = {
    commentText: string;
    reportAction: OptimisticAddCommentReportAction;
};

type UpdateOptimisticParentReportAction = {
    childVisibleActionCount: number;
    childCommenterCount: number;
    childLastVisibleActionCreated: string;
    childOldestFourAccountIDs: string | undefined;
};

type OptimisticExpenseReport = Pick<
    Report,
    | 'reportID'
    | 'chatReportID'
    | 'policyID'
    | 'type'
    | 'ownerAccountID'
    | 'managerID'
    | 'currency'
    | 'reportName'
    | 'stateNum'
    | 'statusNum'
    | 'total'
    | 'unheldTotal'
    | 'nonReimbursableTotal'
    | 'unheldNonReimbursableTotal'
    | 'parentReportID'
    | 'lastVisibleActionCreated'
    | 'parentReportActionID'
    | 'participants'
    | 'fieldList'
>;

type OptimisticNewReport = Pick<
    Report,
    | 'reportID'
    | 'policyID'
    | 'type'
    | 'ownerAccountID'
    | 'reportName'
    | 'stateNum'
    | 'statusNum'
    | 'currency'
    | 'total'
    | 'nonReimbursableTotal'
    | 'parentReportID'
    | 'lastVisibleActionCreated'
    | 'parentReportActionID'
    | 'participants'
    | 'managerID'
    | 'pendingFields'
    | 'chatReportID'
> & {reportName: string};

type BuildOptimisticIOUReportActionParams = {
    type: ValueOf<typeof CONST.IOU.REPORT_ACTION_TYPE>;
    amount: number;
    currency: string;
    comment: string;
    participants: Participant[];
    transactionID: string;
    paymentType?: PaymentMethodType;
    iouReportID?: string;
    isSettlingUp?: boolean;
    isSendMoneyFlow?: boolean;
    isOwnPolicyExpenseChat?: boolean;
    created?: string;
    linkedExpenseReportAction?: OnyxEntry<ReportAction>;
    isPersonalTrackingExpense?: boolean;
    reportActionID?: string;
};

type OptimisticIOUReportAction = Pick<
    ReportAction,
    | 'actionName'
    | 'actorAccountID'
    | 'automatic'
    | 'avatar'
    | 'isAttachmentOnly'
    | 'originalMessage'
    | 'message'
    | 'person'
    | 'reportActionID'
    | 'shouldShow'
    | 'created'
    | 'pendingAction'
    | 'receipt'
    | 'childReportID'
    | 'childVisibleActionCount'
    | 'childCommenterCount'
    | 'delegateAccountID'
>;

type PartialReportAction =
    | OnyxInputOrEntry<ReportAction>
    | Partial<ReportAction>
    | OptimisticIOUReportAction
    | OptimisticApprovedReportAction
    | OptimisticSubmittedReportAction
    | OptimisticConciergeCategoryOptionsAction
    | undefined;

type ReportRouteParams = {
    reportID: string;
    isSubReportPageRoute: boolean;
};

type ReportOfflinePendingActionAndErrors = {
    reportPendingAction: PendingAction | undefined;
    reportErrors: Errors | null | undefined;
};

type OptimisticApprovedReportAction = Pick<
    ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.APPROVED>,
    | 'actionName'
    | 'actorAccountID'
    | 'automatic'
    | 'avatar'
    | 'isAttachmentOnly'
    | 'originalMessage'
    | 'message'
    | 'person'
    | 'reportActionID'
    | 'shouldShow'
    | 'created'
    | 'pendingAction'
    | 'delegateAccountID'
>;

type OptimisticUnapprovedReportAction = Pick<
    ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.UNAPPROVED>,
    | 'actionName'
    | 'actorAccountID'
    | 'automatic'
    | 'avatar'
    | 'isAttachmentOnly'
    | 'originalMessage'
    | 'message'
    | 'person'
    | 'reportActionID'
    | 'shouldShow'
    | 'created'
    | 'pendingAction'
    | 'delegateAccountID'
>;

type OptimisticSubmittedReportAction = Pick<
    ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.SUBMITTED>,
    | 'actionName'
    | 'actorAccountID'
    | 'adminAccountID'
    | 'automatic'
    | 'avatar'
    | 'isAttachmentOnly'
    | 'originalMessage'
    | 'message'
    | 'person'
    | 'reportActionID'
    | 'shouldShow'
    | 'created'
    | 'pendingAction'
    | 'delegateAccountID'
>;

type OptimisticHoldReportAction = Pick<
    ReportAction,
    'actionName' | 'actorAccountID' | 'automatic' | 'avatar' | 'isAttachmentOnly' | 'originalMessage' | 'message' | 'person' | 'reportActionID' | 'shouldShow' | 'created' | 'pendingAction'
>;

type OptimisticReopenedReportAction = Pick<
    ReportAction,
    'actionName' | 'actorAccountID' | 'automatic' | 'avatar' | 'isAttachmentOnly' | 'originalMessage' | 'message' | 'person' | 'reportActionID' | 'shouldShow' | 'created' | 'pendingAction'
>;

type OptimisticRetractedReportAction = Pick<
    ReportAction,
    'actionName' | 'actorAccountID' | 'automatic' | 'avatar' | 'isAttachmentOnly' | 'originalMessage' | 'message' | 'person' | 'reportActionID' | 'shouldShow' | 'created' | 'pendingAction'
>;

type OptimisticCancelPaymentReportAction = Pick<
    ReportAction,
    'actionName' | 'actorAccountID' | 'message' | 'originalMessage' | 'person' | 'reportActionID' | 'shouldShow' | 'created' | 'pendingAction'
>;

type OptimisticChangeFieldAction = Pick<
    OldDotReportAction & ReportAction,
    'actionName' | 'actorAccountID' | 'originalMessage' | 'person' | 'reportActionID' | 'created' | 'pendingAction' | 'message'
>;

type OptimisticEditedTaskReportAction = Pick<
    ReportAction,
    'reportActionID' | 'actionName' | 'pendingAction' | 'actorAccountID' | 'automatic' | 'avatar' | 'created' | 'shouldShow' | 'message' | 'person' | 'delegateAccountID'
>;

type OptimisticClosedReportAction = Pick<
    ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.CLOSED>,
    'actionName' | 'actorAccountID' | 'automatic' | 'avatar' | 'created' | 'message' | 'originalMessage' | 'pendingAction' | 'person' | 'reportActionID' | 'shouldShow'
>;

type OptimisticCardAssignedReportAction = Pick<
    ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.CARD_ASSIGNED>,
    'actionName' | 'actorAccountID' | 'automatic' | 'avatar' | 'created' | 'message' | 'originalMessage' | 'pendingAction' | 'person' | 'reportActionID' | 'shouldShow'
>;

type OptimisticDismissedViolationReportAction = Pick<
    ReportAction,
    'actionName' | 'actorAccountID' | 'avatar' | 'created' | 'message' | 'originalMessage' | 'person' | 'reportActionID' | 'shouldShow' | 'pendingAction'
>;

type OptimisticCreatedReportAction = Pick<
    ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.CREATED>,
    'actorAccountID' | 'automatic' | 'avatar' | 'created' | 'message' | 'person' | 'reportActionID' | 'shouldShow' | 'pendingAction' | 'actionName' | 'delegateAccountID'
>;

type OptimisticConciergeCategoryOptionsAction = Pick<
    ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.CONCIERGE_CATEGORY_OPTIONS>,
    'reportActionID' | 'actionName' | 'actorAccountID' | 'person' | 'automatic' | 'avatar' | 'created' | 'message' | 'pendingAction' | 'shouldShow' | 'originalMessage' | 'errors'
> & {isOptimisticAction: boolean};

type OptimisticRenamedReportAction = Pick<
    ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.RENAMED>,
    'actorAccountID' | 'automatic' | 'avatar' | 'created' | 'message' | 'person' | 'reportActionID' | 'shouldShow' | 'pendingAction' | 'actionName' | 'originalMessage'
>;

type OptimisticRoomDescriptionUpdatedReportAction = Pick<
    ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.ROOM_CHANGE_LOG.UPDATE_ROOM_DESCRIPTION>,
    'actorAccountID' | 'created' | 'message' | 'person' | 'reportActionID' | 'pendingAction' | 'actionName' | 'originalMessage'
>;

type OptimisticChatReport = Pick<
    Report,
    | 'type'
    | 'chatType'
    | 'chatReportID'
    | 'iouReportID'
    | 'isOwnPolicyExpenseChat'
    | 'isPinned'
    | 'lastActorAccountID'
    | 'lastMessageHtml'
    | 'lastMessageText'
    | 'lastReadTime'
    | 'lastVisibleActionCreated'
    | 'oldPolicyName'
    | 'ownerAccountID'
    | 'pendingFields'
    | 'parentReportActionID'
    | 'parentReportID'
    | 'participants'
    | 'policyID'
    | 'reportID'
    | 'reportName'
    | 'stateNum'
    | 'statusNum'
    | 'visibility'
    | 'description'
    | 'writeCapability'
    | 'avatarUrl'
    | 'invoiceReceiver'
>;

type OptimisticExportIntegrationAction = OriginalMessageExportedToIntegration &
    Pick<
        ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.EXPORTED_TO_INTEGRATION>,
        'reportActionID' | 'actorAccountID' | 'avatar' | 'created' | 'lastModified' | 'message' | 'person' | 'shouldShow' | 'pendingAction' | 'errors' | 'automatic'
    >;

type OptimisticTaskReportAction = Pick<
    ReportAction,
    | 'reportActionID'
    | 'actionName'
    | 'actorAccountID'
    | 'automatic'
    | 'avatar'
    | 'created'
    | 'isAttachmentOnly'
    | 'message'
    | 'originalMessage'
    | 'person'
    | 'pendingAction'
    | 'shouldShow'
    | 'isFirstItem'
    | 'previousMessage'
    | 'errors'
    | 'linkMetadata'
    | 'delegateAccountID'
>;

type AnnounceRoomOnyxData = {
    onyxOptimisticData: OnyxUpdate[];
    onyxSuccessData: OnyxUpdate[];
    onyxFailureData: OnyxUpdate[];
};

type OptimisticAnnounceChat = {
    announceChatReportID: string;
    announceChatReportActionID: string;
    announceChatData: AnnounceRoomOnyxData;
};

type OptimisticWorkspaceChats = {
    adminsChatReportID: string;
    adminsChatData: OptimisticChatReport;
    adminsReportActionData: Record<string, OptimisticCreatedReportAction>;
    adminsCreatedReportActionID: string;
    expenseChatReportID: string;
    expenseChatData: OptimisticChatReport;
    expenseReportActionData: Record<string, OptimisticCreatedReportAction>;
    expenseCreatedReportActionID: string;
    pendingChatMembers: PendingChatMember[];
};

type OptimisticModifiedExpenseReportAction = Pick<
    ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.MODIFIED_EXPENSE>,
    | 'actionName'
    | 'actorAccountID'
    | 'automatic'
    | 'avatar'
    | 'created'
    | 'isAttachmentOnly'
    | 'message'
    | 'originalMessage'
    | 'person'
    | 'pendingAction'
    | 'reportActionID'
    | 'shouldShow'
    | 'delegateAccountID'
> & {reportID?: string};

type OptimisticMoneyRequestEntities = {
    iouReport: Report;
    type: ValueOf<typeof CONST.IOU.REPORT_ACTION_TYPE>;
    amount: number;
    currency: string;
    comment: string;
    payeeEmail: string;
    participants: Participant[];
    transactionID: string;
    paymentType?: PaymentMethodType;
    isSettlingUp?: boolean;
    isSendMoneyFlow?: boolean;
    isOwnPolicyExpenseChat?: boolean;
    isPersonalTrackingExpense?: boolean;
    existingTransactionThreadReportID?: string;
    linkedTrackedExpenseReportAction?: ReportAction;
    optimisticCreatedReportActionID?: string;
};

type OptimisticTaskReport = SetRequired<
    Pick<
        Report,
        | 'reportID'
        | 'reportName'
        | 'description'
        | 'ownerAccountID'
        | 'participants'
        | 'managerID'
        | 'type'
        | 'parentReportID'
        | 'policyID'
        | 'stateNum'
        | 'statusNum'
        | 'parentReportActionID'
        | 'lastVisibleActionCreated'
        | 'hasParentAccess'
    >,
    'parentReportID'
>;

type TransactionDetails = {
    created: string;
    amount: number;
    attendees: Attendee[] | string;
    taxAmount?: number;
    taxCode?: string;
    currency: string;
    merchant: string;
    waypoints?: WaypointCollection | string;
    customUnitRateID?: string;
    comment: string;
    category: string;
    billable: boolean;
    tag: string;
    mccGroup?: ValueOf<typeof CONST.MCC_GROUPS>;
    description?: string;
    cardID: number;
    cardName?: string;
    originalAmount: number;
    originalCurrency: string;
    postedDate: string;
};

type OptimisticIOUReport = Pick<
    Report,
    | 'type'
    | 'chatReportID'
    | 'currency'
    | 'managerID'
    | 'policyID'
    | 'ownerAccountID'
    | 'participants'
    | 'reportID'
    | 'stateNum'
    | 'statusNum'
    | 'total'
    | 'unheldTotal'
    | 'nonReimbursableTotal'
    | 'unheldNonReimbursableTotal'
    | 'reportName'
    | 'parentReportID'
    | 'lastVisibleActionCreated'
    | 'fieldList'
    | 'parentReportActionID'
>;
type DisplayNameWithTooltips = Array<Pick<PersonalDetails, 'accountID' | 'pronouns' | 'displayName' | 'login' | 'avatar'>>;

type CustomIcon = {
    src: IconAsset;
    color?: string;
};

type OptionData = {
    text?: string;
    alternateText?: string;
    allReportErrors?: Errors;
    brickRoadIndicator?: ValueOf<typeof CONST.BRICK_ROAD_INDICATOR_STATUS> | '' | null;
    tooltipText?: string | null;
    alternateTextMaxLines?: number;
    boldStyle?: boolean;
    customIcon?: CustomIcon;
    subtitle?: string;
    login?: string;
    accountID?: number;
    pronouns?: string;
    status?: Status | null;
    phoneNumber?: string;
    isUnread?: boolean | null;
    isUnreadWithMention?: boolean | null;
    hasDraftComment?: boolean | null;
    keyForList?: string;
    searchText?: string;
    isIOUReportOwner?: boolean | null;
    shouldShowSubscript?: boolean | null;
    isPolicyExpenseChat?: boolean;
    isMoneyRequestReport?: boolean | null;
    isInvoiceReport?: boolean;
    isExpenseRequest?: boolean | null;
    isAllowedToComment?: boolean | null;
    isThread?: boolean | null;
    isTaskReport?: boolean | null;
    parentReportAction?: OnyxEntry<ReportAction>;
    displayNamesWithTooltips?: DisplayNameWithTooltips | null;
    isDefaultRoom?: boolean;
    isInvoiceRoom?: boolean;
    isExpenseReport?: boolean;
    isOptimisticPersonalDetail?: boolean;
    selected?: boolean;
    isOptimisticAccount?: boolean;
    isSelected?: boolean;
    descriptiveText?: string;
    notificationPreference?: NotificationPreference | null;
    isDisabled?: boolean | null;
    name?: string | null;
    isSelfDM?: boolean;
    isOneOnOneChat?: boolean;
    reportID?: string;
    enabled?: boolean;
    code?: string;
    transactionThreadReportID?: string | null;
    shouldShowAmountInput?: boolean;
    amountInputProps?: MoneyRequestAmountInputProps;
    tabIndex?: 0 | -1;
    isConciergeChat?: boolean;
    isBold?: boolean;
    lastIOUCreationDate?: string;
    isChatRoom?: boolean;
    participantsList?: PersonalDetails[];
    icons?: Icon[];
    iouReportAmount?: number;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    avatar?: AvatarSource;
} & Report &
    ReportNameValuePairs;

type OnyxDataTaskAssigneeChat = {
    optimisticData: OnyxUpdate[];
    successData: OnyxUpdate[];
    failureData: OnyxUpdate[];
    optimisticAssigneeAddComment?: OptimisticReportAction;
    optimisticChatCreatedReportAction?: OptimisticCreatedReportAction;
};

type Ancestor = {
    report: Report;
    reportAction: ReportAction;
    shouldDisplayNewMarker: boolean;
};

type AncestorIDs = {
    reportIDs: string[];
    reportActionsIDs: string[];
};

type MissingPaymentMethod = 'bankAccount' | 'wallet';

type OutstandingChildRequest = {
    hasOutstandingChildRequest?: boolean;
};

type ParsingDetails = {
    /**
     * this param is deprecated
     * Currently there are no calls/reference that use this param
     * This should be removed after https://github.com/Expensify/App/issues/50724 as a followup
     */
    shouldEscapeText?: boolean;
    reportID?: string;
    policyID?: string;
};

type NonHeldAndFullAmount = {
    nonHeldAmount: string;
    fullAmount: string;
    /**
     * nonHeldAmount is valid if not negative;
     * It can be negative if the unheld transaction comes from the current user
     */
    hasValidNonHeldAmount: boolean;
};

type Thread = {
    parentReportID: string;
    parentReportActionID: string;
} & Report;

type GetChatRoomSubtitleConfig = {
    isCreateExpenseFlow?: boolean;
};

type SelfDMParameters = {
    reportID?: string;
    createdReportActionID?: string;
};

type GetPolicyNameParams = {
    report: OnyxInputOrEntry<Report>;
    returnEmptyIfNotFound?: boolean;
    policy?: OnyxInputOrEntry<Policy> | SearchPolicy;
    policies?: SearchPolicy[];
    reports?: SearchReport[];
};

type GetReportNameParams = {
    report: OnyxEntry<Report>;
    policy?: OnyxEntry<Policy> | SearchPolicy;
    parentReportActionParam?: OnyxInputOrEntry<ReportAction>;
    personalDetails?: Partial<PersonalDetailsList>;
    invoiceReceiverPolicy?: OnyxEntry<Policy> | SearchPolicy;
    transactions?: SearchTransaction[];
    reports?: SearchReport[];
    draftReports?: OnyxCollection<Report>;
    reportNameValuePairs?: OnyxCollection<ReportNameValuePairs>;
    policies?: SearchPolicy[];
};

type ReportByPolicyMap = Record<string, OnyxCollection<Report>>;

let currentUserEmail: string | undefined;
let currentUserPrivateDomain: string | undefined;
let currentUserAccountID: number | undefined;
let isAnonymousUser = false;

let environmentURL: string;
getEnvironmentURL().then((url: string) => (environmentURL = url));
let environment: EnvironmentType;
getEnvironment().then((env) => {
    environment = env;
});

// This cache is used to save parse result of report action html message into text
// to prevent unnecessary parsing when the report action is not changed/modified.
// Example case: when we need to get a report name of a thread which is dependent on a report action message.
const parsedReportActionMessageCache: Record<string, string> = {};

let conciergeReportID: OnyxEntry<string>;
Onyx.connect({
    key: ONYXKEYS.CONCIERGE_REPORT_ID,
    callback: (value) => {
        conciergeReportID = value;
    },
});

const defaultAvatarBuildingIconTestID = 'SvgDefaultAvatarBuilding Icon';
Onyx.connect({
    key: ONYXKEYS.SESSION,
    callback: (value) => {
        // When signed out, val is undefined
        if (!value) {
            return;
        }

        currentUserEmail = value.email;
        currentUserAccountID = value.accountID;
        isAnonymousUser = value.authTokenType === CONST.AUTH_TOKEN_TYPES.ANONYMOUS;
        currentUserPrivateDomain = isEmailPublicDomain(currentUserEmail ?? '') ? '' : Str.extractEmailDomain(currentUserEmail ?? '');
    },
});

let allPersonalDetails: OnyxEntry<PersonalDetailsList>;
let allPersonalDetailLogins: string[];
let currentUserPersonalDetails: OnyxEntry<PersonalDetails>;
Onyx.connect({
    key: ONYXKEYS.PERSONAL_DETAILS_LIST,
    callback: (value) => {
        if (currentUserAccountID) {
            currentUserPersonalDetails = value?.[currentUserAccountID] ?? undefined;
        }
        allPersonalDetails = value ?? {};
        allPersonalDetailLogins = Object.values(allPersonalDetails).map((personalDetail) => personalDetail?.login ?? '');
    },
});

let allReportsDraft: OnyxCollection<Report>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_DRAFT,
    waitForCollectionCallback: true,
    callback: (value) => (allReportsDraft = value),
});

let allPolicies: OnyxCollection<Policy>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.POLICY,
    waitForCollectionCallback: true,
    callback: (value) => (allPolicies = value),
});

let allReports: OnyxCollection<Report>;
let reportsByPolicyID: ReportByPolicyMap;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT,
    waitForCollectionCallback: true,
    callback: (value) => {
        allReports = value;
        UnreadIndicatorUpdaterHelper().then((module) => {
            module.triggerUnreadUpdate();
        });

        if (!value) {
            return;
        }

        reportsByPolicyID = Object.entries(value).reduce<ReportByPolicyMap>((acc, [reportID, report]) => {
            if (!report) {
                return acc;
            }

            handleReportChanged(report);

            // Get all reports, which are the ones that are:
            // - Owned by the same user
            // - Are either open or submitted
            // - Belong to the same workspace
            if (report.policyID && report.ownerAccountID === currentUserAccountID && (report.stateNum ?? 0) <= 1) {
                if (!acc[report.policyID]) {
                    acc[report.policyID] = {};
                }

                acc[report.policyID] = {
                    ...acc[report.policyID],
                    [reportID]: report,
                };
            }

            return acc;
        }, {});
    },
});

let allBetas: OnyxEntry<Beta[]>;
Onyx.connect({
    key: ONYXKEYS.BETAS,
    callback: (value) => (allBetas = value),
});

let allTransactions: OnyxCollection<Transaction> = {};
let reportsTransactions: Record<string, Transaction[]> = {};
Onyx.connect({
    key: ONYXKEYS.COLLECTION.TRANSACTION,
    waitForCollectionCallback: true,
    callback: (value) => {
        if (!value) {
            return;
        }
        allTransactions = Object.fromEntries(Object.entries(value).filter(([, transaction]) => transaction));

        reportsTransactions = Object.values(value).reduce<Record<string, Transaction[]>>((all, transaction) => {
            const reportsMap = all;
            if (!transaction?.reportID) {
                return reportsMap;
            }

            if (!reportsMap[transaction.reportID]) {
                reportsMap[transaction.reportID] = [];
            }
            reportsMap[transaction.reportID].push(transaction);

            return all;
        }, {});
    },
});

let allReportActions: OnyxCollection<ReportActions>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_ACTIONS,
    waitForCollectionCallback: true,
    callback: (actions) => {
        if (!actions) {
            return;
        }
        allReportActions = actions;
    },
});

let allReportMetadata: OnyxCollection<ReportMetadata>;
const allReportMetadataKeyValue: Record<string, ReportMetadata> = {};
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_METADATA,
    waitForCollectionCallback: true,
    callback: (value) => {
        if (!value) {
            return;
        }
        allReportMetadata = value;

        Object.entries(value).forEach(([reportID, reportMetadata]) => {
            if (!reportMetadata) {
                return;
            }

            const [, id] = reportID.split('_');
            allReportMetadataKeyValue[id] = reportMetadata;
        });
    },
});

let allReportNameValuePair: OnyxCollection<ReportNameValuePairs>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS,
    waitForCollectionCallback: true,
    callback: (value) => {
        if (!value) {
            return;
        }
        allReportNameValuePair = value;
    },
});

let allReportsViolations: OnyxCollection<ReportViolations>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_VIOLATIONS,
    waitForCollectionCallback: true,
    callback: (value) => {
        if (!value) {
            return;
        }
        allReportsViolations = value;
    },
});

let onboarding: OnyxEntry<Onboarding>;
Onyx.connect({
    key: ONYXKEYS.NVP_ONBOARDING,
    callback: (value) => (onboarding = value),
});

let delegateEmail = '';
Onyx.connect({
    key: ONYXKEYS.ACCOUNT,
    callback: (value) => {
        delegateEmail = value?.delegatedAccess?.delegate ?? '';
    },
});

let activePolicyID: OnyxEntry<string>;
Onyx.connect({
    key: ONYXKEYS.NVP_ACTIVE_POLICY_ID,
    callback: (value) => (activePolicyID = value),
});

let reportAttributesDerivedValue: ReportAttributesDerivedValue['reports'];
Onyx.connect({
    key: ONYXKEYS.DERIVED.REPORT_ATTRIBUTES,
    callback: (value) => {
        reportAttributesDerivedValue = value?.reports ?? {};
    },
});

let newGroupChatDraft: OnyxEntry<NewGroupChatDraft>;
Onyx.connect({
    key: ONYXKEYS.NEW_GROUP_CHAT_DRAFT,
    callback: (value) => (newGroupChatDraft = value),
});

let onboardingCompanySize: OnyxEntry<OnboardingCompanySize>;
Onyx.connect({
    key: ONYXKEYS.ONBOARDING_COMPANY_SIZE,
    callback: (value) => {
        onboardingCompanySize = value;
    },
});

let hiddenTranslation = '';
let unavailableTranslation = '';

Onyx.connect({
    key: ONYXKEYS.ARE_TRANSLATIONS_LOADING,
    initWithStoredValues: false,
    callback: (value) => {
        if (value ?? true) {
            return;
        }
        hiddenTranslation = translateLocal('common.hidden');
        unavailableTranslation = translateLocal('workspace.common.unavailable');
    },
});

function getCurrentUserAvatar(): AvatarSource | undefined {
    return currentUserPersonalDetails?.avatar;
}

function getCurrentUserDisplayNameOrEmail(): string | undefined {
    return currentUserPersonalDetails?.displayName ?? currentUserEmail;
}

function getChatType(report: OnyxInputOrEntry<Report> | Participant): ValueOf<typeof CONST.REPORT.CHAT_TYPE> | undefined {
    return report?.chatType;
}

/**
 * Get the report or draft report given a reportID
 */
function getReportOrDraftReport(reportID: string | undefined, searchReports?: SearchReport[]): OnyxEntry<Report> | SearchReport {
    const searchReport = searchReports?.find((report) => report.reportID === reportID);
    const onyxReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
    return searchReport ?? onyxReport ?? allReportsDraft?.[`${ONYXKEYS.COLLECTION.REPORT_DRAFT}${reportID}`];
}

function reportTransactionsSelector(transactions: OnyxCollection<Transaction>, reportID: string | undefined): Transaction[] {
    if (!transactions || !reportID) {
        return [];
    }

    return Object.values(transactions).filter((transaction): transaction is Transaction => !!transaction && transaction.reportID === reportID);
}

function getReportTransactions(reportID: string | undefined, allReportsTransactions: Record<string, Transaction[]> = reportsTransactions): Transaction[] {
    if (!reportID) {
        return [];
    }

    return allReportsTransactions[reportID] ?? [];
}

/**
 * Check if a report is a draft report
 */
function isDraftReport(reportID: string | undefined): boolean {
    const draftReport = allReportsDraft?.[`${ONYXKEYS.COLLECTION.REPORT_DRAFT}${reportID}`];

    return !!draftReport;
}
/**
 * @private
 */
function isSearchReportArray(object: SearchReport[] | OnyxCollection<Report>): object is SearchReport[] {
    if (!Array.isArray(object)) {
        return false;
    }
    const firstItem = object.at(0);
    return firstItem !== undefined && 'private_isArchived' in firstItem;
}

/**
 * @private
 * Returns the report
 */
function getReport(reportID: string, reports: SearchReport[] | OnyxCollection<Report>): OnyxEntry<Report> | SearchReport {
    if (isSearchReportArray(reports)) {
        reports?.find((report) => report.reportID === reportID);
    } else {
        return reports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
    }
}

/**
 * Returns the report
 * @deprecated Get the data straight from Onyx
 */
function getReportNameValuePairs(reportID?: string, reportNameValuePairs: OnyxCollection<ReportNameValuePairs> = allReportNameValuePair): OnyxEntry<ReportNameValuePairs> {
    return reportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${reportID}`];
}

/**
 * Returns the parentReport if the given report is a thread
 */
function getParentReport(report: OnyxEntry<Report>): OnyxEntry<Report> {
    if (!report?.parentReportID) {
        return undefined;
    }
    return getReport(report.parentReportID, allReports);
}

/**
 * Returns the root parentReport if the given report is nested.
 * Uses recursion to iterate any depth of nested reports.
 */

function getRootParentReport({
    report,
    reports,
    visitedReportIDs = new Set<string>(),
}: {
    report: OnyxEntry<Report>;
    reports?: SearchReport[];
    visitedReportIDs?: Set<string>;
}): OnyxEntry<Report> {
    if (!report) {
        return undefined;
    }

    // Returns the current report as the root report, because it does not have a parentReportID
    if (!report?.parentReportID) {
        return report;
    }

    // Detect and prevent an infinite loop caused by a cycle in the ancestry. This should normally
    // never happen
    if (visitedReportIDs.has(report.reportID)) {
        Log.alert('Report ancestry cycle detected.', {reportID: report.reportID, ancestry: Array.from(visitedReportIDs)});
        return undefined;
    }
    visitedReportIDs.add(report.reportID);

    const parentReport = getReportOrDraftReport(report?.parentReportID, reports);

    // Runs recursion to iterate a parent report
    return getRootParentReport({report: !isEmptyObject(parentReport) ? parentReport : undefined, visitedReportIDs, reports});
}

/**
 * Returns the policy of the report
 * @deprecated Get the data straight from Onyx - This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
 */
function getPolicy(policyID: string | undefined): OnyxEntry<Policy> {
    if (!allPolicies || !policyID) {
        return undefined;
    }
    return allPolicies[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`];
}

/**
 * Get the policy type from a given report
 * @param policies must have Onyxkey prefix (i.e 'policy_') for keys
 */
function getPolicyType(report: OnyxInputOrEntry<Report>, policies: OnyxCollection<Policy>): string {
    return policies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]?.type ?? '';
}

/**
 * Get the policy name from a given report
 */
function getPolicyName({report, returnEmptyIfNotFound = false, policy, policies, reports}: GetPolicyNameParams): string {
    const noPolicyFound = returnEmptyIfNotFound ? '' : unavailableTranslation;
    if (isEmptyObject(report) || (isEmptyObject(policies) && isEmptyObject(allPolicies) && !report?.policyName)) {
        return noPolicyFound;
    }
    const finalPolicy = (() => {
        if (isEmptyObject(policy)) {
            if (policies) {
                return policies.find((p) => p.id === report.policyID);
            }
            return allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report.policyID}`];
        }
        return policy ?? policies?.find((p) => p.id === report.policyID);
    })();

    const parentReport = getRootParentReport({report, reports});

    // Rooms send back the policy name with the reportSummary,
    // since they can also be accessed by people who aren't in the workspace
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const policyName = finalPolicy?.name || report?.policyName || report?.oldPolicyName || parentReport?.oldPolicyName || noPolicyFound;

    return policyName;
}

/**
 * Returns the concatenated title for the PrimaryLogins of a report
 */
function getReportParticipantsTitle(accountIDs: number[]): string {
    // Somehow it's possible for the logins coming from report.participantAccountIDs to contain undefined values so we use .filter(Boolean) to remove them.
    return accountIDs.filter(Boolean).join(', ');
}

/**
 * Checks if a report is a chat report.
 */
function isChatReport(report: OnyxEntry<Report>): boolean {
    return report?.type === CONST.REPORT.TYPE.CHAT;
}

function isInvoiceReport(report: OnyxInputOrEntry<Report> | SearchReport): boolean {
    return report?.type === CONST.REPORT.TYPE.INVOICE;
}

function isFinancialReportsForBusinesses(report: OnyxEntry<Report>): boolean {
    return report?.type === CONST.REPORT.TYPE.EXPENSE || report?.type === CONST.REPORT.TYPE.INVOICE;
}

function isNewDotInvoice(invoiceRoomID: string | undefined): boolean {
    if (!invoiceRoomID) {
        return false;
    }

    return isInvoiceRoom(getReport(invoiceRoomID, allReports));
}

/**
 * Checks if the report with supplied ID has been approved or not
 */
function isReportIDApproved(reportID: string | undefined) {
    if (!reportID) {
        return;
    }
    const report = getReport(reportID, allReports);
    if (!report) {
        return;
    }
    return isReportApproved({report});
}

/**
 * Checks if a report is an Expense report.
 */
function isExpenseReport(report: OnyxInputOrEntry<Report> | SearchReport): boolean {
    return report?.type === CONST.REPORT.TYPE.EXPENSE;
}

/**
 * Checks if a report is an IOU report using report or reportID
 */
function isIOUReport(reportOrID: OnyxInputOrEntry<Report> | SearchReport | string): boolean {
    const report = typeof reportOrID === 'string' ? (getReport(reportOrID, allReports) ?? null) : reportOrID;
    return report?.type === CONST.REPORT.TYPE.IOU;
}

/**
 * Checks if a report is an IOU report using report
 */
function isIOUReportUsingReport(report: OnyxEntry<Report>): report is Report {
    return report?.type === CONST.REPORT.TYPE.IOU;
}
/**
 * Checks if a report is a task report.
 */
function isTaskReport(report: OnyxInputOrEntry<Report>): boolean {
    return report?.type === CONST.REPORT.TYPE.TASK;
}

/**
 * Checks if a task has been cancelled
 * When a task is deleted, the parentReportAction is updated to have a isDeletedParentAction deleted flag
 * This is because when you delete a task, we still allow you to chat on the report itself
 * There's another situation where you don't have access to the parentReportAction (because it was created in a chat you don't have access to)
 * In this case, we have added the key to the report itself
 */
function isCanceledTaskReport(report: OnyxInputOrEntry<Report>, parentReportAction: OnyxInputOrEntry<ReportAction> = null): boolean {
    if (!isEmptyObject(parentReportAction) && (getReportActionMessageReportUtils(parentReportAction)?.isDeletedParentAction ?? false)) {
        return true;
    }

    if (!isEmptyObject(report) && report?.isDeletedParentAction) {
        return true;
    }

    return false;
}

/**
 * Checks if a report is an open task report.
 *
 * @param parentReportAction - The parent report action of the report (Used to check if the task has been canceled)
 */
function isOpenTaskReport(report: OnyxInputOrEntry<Report>, parentReportAction: OnyxInputOrEntry<ReportAction> = null): boolean {
    return (
        isTaskReport(report) && !isCanceledTaskReport(report, parentReportAction) && report?.stateNum === CONST.REPORT.STATE_NUM.OPEN && report?.statusNum === CONST.REPORT.STATUS_NUM.OPEN
    );
}

/**
 * Checks if a report is a completed task report.
 */
function isCompletedTaskReport(report: OnyxEntry<Report>): boolean {
    return isTaskReport(report) && report?.stateNum === CONST.REPORT.STATE_NUM.APPROVED && report?.statusNum === CONST.REPORT.STATUS_NUM.APPROVED;
}

/**
 * Checks if the current user is the manager of the supplied report
 */
function isReportManager(report: OnyxEntry<Report>): boolean {
    return !!(report && report.managerID === currentUserAccountID);
}

/**
 * Checks if the supplied report has been approved
 */
function isReportApproved({report, parentReportAction = undefined}: {report: OnyxInputOrEntry<Report>; parentReportAction?: OnyxEntry<ReportAction> | undefined}): boolean {
    if (!report) {
        return parentReportAction?.childStateNum === CONST.REPORT.STATE_NUM.APPROVED && parentReportAction?.childStatusNum === CONST.REPORT.STATUS_NUM.APPROVED;
    }
    return report?.stateNum === CONST.REPORT.STATE_NUM.APPROVED && report?.statusNum === CONST.REPORT.STATUS_NUM.APPROVED;
}

/**
 * Checks if the supplied report has been manually reimbursed
 */
function isReportManuallyReimbursed(report: OnyxEntry<Report>): boolean {
    return report?.stateNum === CONST.REPORT.STATE_NUM.APPROVED && report?.statusNum === CONST.REPORT.STATUS_NUM.REIMBURSED;
}

/**
 * Checks if the supplied report is an expense report in Open state and status.
 */
function isOpenExpenseReport(report: OnyxInputOrEntry<Report>): boolean {
    return isExpenseReport(report) && report?.stateNum === CONST.REPORT.STATE_NUM.OPEN && report?.statusNum === CONST.REPORT.STATUS_NUM.OPEN;
}

/**
 * Checks if the supplied report has a member with the array passed in params.
 */
function hasParticipantInArray(report: OnyxEntry<Report>, memberAccountIDs: number[]) {
    if (!report?.participants) {
        return false;
    }

    const memberAccountIDsSet = new Set(memberAccountIDs);

    for (const accountID in report.participants) {
        if (memberAccountIDsSet.has(Number(accountID))) {
            return true;
        }
    }

    return false;
}

/**
 * Whether the Money Request report is settled
 */
function isSettled(reportOrID: OnyxInputOrEntry<Report> | SearchReport | string | undefined, reports?: SearchReport[] | OnyxCollection<Report>): boolean {
    if (!reportOrID) {
        return false;
    }
    const report = typeof reportOrID === 'string' ? (getReport(reportOrID, reports ?? allReports) ?? null) : reportOrID;
    if (!report) {
        return false;
    }

    if (isEmptyObject(report)) {
        return false;
    }

    // In case the payment is scheduled and we are waiting for the payee to set up their wallet,
    // consider the report as paid as well.
    if (report.isWaitingOnBankAccount && report.statusNum === CONST.REPORT.STATUS_NUM.APPROVED) {
        return false;
    }

    return report?.statusNum === CONST.REPORT.STATUS_NUM.REIMBURSED;
}

/**
 * Whether the current user is the submitter of the report
 */
function isCurrentUserSubmitter(report: OnyxEntry<Report>): boolean {
    return !!report && report.ownerAccountID === currentUserAccountID;
}

/**
 * Whether the provided report is an Admin room
 */
function isAdminRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_ADMINS;
}

/**
 * Whether the provided report is an Admin-only posting room
 */
function isAdminsOnlyPostingRoom(report: OnyxEntry<Report>): boolean {
    return report?.writeCapability === CONST.REPORT.WRITE_CAPABILITIES.ADMINS;
}

/**
 * Whether the provided report is a Announce room
 */
function isAnnounceRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE;
}

/**
 * Whether the provided report is a default room
 */
function isDefaultRoom(report: OnyxEntry<Report>): boolean {
    return CONST.DEFAULT_POLICY_ROOM_CHAT_TYPES.some((type) => type === getChatType(report));
}

/**
 * Whether the provided report is a Domain room
 */
function isDomainRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.DOMAIN_ALL;
}

/**
 * Whether the provided report is a user created policy room
 */
function isUserCreatedPolicyRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_ROOM;
}

/**
 * Whether the provided report is a Policy Expense chat.
 */
function isPolicyExpenseChat(option: OnyxInputOrEntry<Report> | OptionData | Participant): boolean {
    return getChatType(option) === CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT || !!(option && typeof option === 'object' && 'isPolicyExpenseChat' in option && option.isPolicyExpenseChat);
}

function isInvoiceRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.INVOICE;
}

function isInvoiceRoomWithID(reportID?: string): boolean {
    if (!reportID) {
        return false;
    }
    const report = getReport(reportID, allReports);
    return isInvoiceRoom(report);
}

/**
 * Checks if a report is a completed task report.
 */
function isTripRoom(report: OnyxEntry<Report>): boolean {
    return isChatReport(report) && getChatType(report) === CONST.REPORT.CHAT_TYPE.TRIP_ROOM;
}

function isIndividualInvoiceRoom(report: OnyxEntry<Report>): boolean {
    return isInvoiceRoom(report) && report?.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL;
}

function isCurrentUserInvoiceReceiver(report: OnyxEntry<Report>): boolean {
    if (report?.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL) {
        return currentUserAccountID === report.invoiceReceiver.accountID;
    }

    if (report?.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.BUSINESS) {
        // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
        // eslint-disable-next-line deprecation/deprecation
        const policy = getPolicy(report.invoiceReceiver.policyID);
        return isPolicyAdminPolicyUtils(policy);
    }

    return false;
}

/**
 * Whether the provided report belongs to a Control policy and is an expense chat
 */
function isControlPolicyExpenseChat(report: OnyxEntry<Report>): boolean {
    return isPolicyExpenseChat(report) && getPolicyType(report, allPolicies) === CONST.POLICY.TYPE.CORPORATE;
}

/**
 * Whether the provided policyType is a Free, Collect or Control policy type
 */
function isGroupPolicy(policyType: string): boolean {
    return policyType === CONST.POLICY.TYPE.CORPORATE || policyType === CONST.POLICY.TYPE.TEAM;
}

/**
 * Whether the provided report belongs to a Free, Collect or Control policy
 */
function isReportInGroupPolicy(report: OnyxInputOrEntry<Report>, policy?: OnyxInputOrEntry<Policy>): boolean {
    const policyType = policy?.type ?? getPolicyType(report, allPolicies);
    return isGroupPolicy(policyType);
}

/**
 * Whether the provided report belongs to a Control or Collect policy
 */
function isPaidGroupPolicy(report: OnyxEntry<Report>): boolean {
    const policyType = getPolicyType(report, allPolicies);
    return policyType === CONST.POLICY.TYPE.CORPORATE || policyType === CONST.POLICY.TYPE.TEAM;
}

/**
 * Whether the provided report belongs to a Control or Collect policy and is an expense chat
 */
function isPaidGroupPolicyExpenseChat(report: OnyxEntry<Report>): boolean {
    return isPolicyExpenseChat(report) && isPaidGroupPolicy(report);
}

/**
 * Whether the provided report belongs to a Control policy and is an expense report
 */
function isControlPolicyExpenseReport(report: OnyxEntry<Report>): boolean {
    return isExpenseReport(report) && getPolicyType(report, allPolicies) === CONST.POLICY.TYPE.CORPORATE;
}

/**
 * Whether the provided report belongs to a Control or Collect policy and is an expense report
 */
function isPaidGroupPolicyExpenseReport(report: OnyxEntry<Report>): boolean {
    return isExpenseReport(report) && isPaidGroupPolicy(report);
}

/**
 * Checks if the supplied report is an invoice report in Open state and status.
 */
function isOpenInvoiceReport(report: OnyxEntry<Report>): boolean {
    return isInvoiceReport(report) && report?.statusNum === CONST.REPORT.STATUS_NUM.OPEN;
}

/**
 * Whether the provided report is a chat room
 */
function isChatRoom(report: OnyxEntry<Report>): boolean {
    return isUserCreatedPolicyRoom(report) || isDefaultRoom(report) || isInvoiceRoom(report) || isTripRoom(report);
}

/**
 * Whether the provided report is a public room
 */
function isPublicRoom(report: OnyxEntry<Report>): boolean {
    return report?.visibility === CONST.REPORT.VISIBILITY.PUBLIC || report?.visibility === CONST.REPORT.VISIBILITY.PUBLIC_ANNOUNCE;
}

/**
 * Whether the provided report is a public announce room
 */
function isPublicAnnounceRoom(report: OnyxEntry<Report>): boolean {
    return report?.visibility === CONST.REPORT.VISIBILITY.PUBLIC_ANNOUNCE;
}

/**
 * If the report is a policy expense, the route should be for adding bank account for that policy
 * else since the report is a personal IOU, the route should be for personal bank account.
 */
function getBankAccountRoute(report: OnyxEntry<Report>): Route {
    if (isPolicyExpenseChat(report)) {
        return ROUTES.BANK_ACCOUNT_WITH_STEP_TO_OPEN.getRoute(report?.policyID, undefined, Navigation.getActiveRoute());
    }

    if (isInvoiceRoom(report) && report?.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.BUSINESS) {
        const invoiceReceiverPolicy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.invoiceReceiver?.policyID}`];
        if (invoiceReceiverPolicy?.areInvoicesEnabled) {
            return ROUTES.WORKSPACE_INVOICES.getRoute(report?.invoiceReceiver?.policyID);
        }
    }

    return ROUTES.SETTINGS_ADD_BANK_ACCOUNT.route;
}

/**
 * Check if personal detail of accountID is empty or optimistic data
 */
function isOptimisticPersonalDetail(accountID: number): boolean {
    return isEmptyObject(allPersonalDetails?.[accountID]) || !!allPersonalDetails?.[accountID]?.isOptimisticPersonalDetail;
}

/**
 * Checks if a report is a task report from a policy expense chat.
 */
function isWorkspaceTaskReport(report: OnyxEntry<Report>): boolean {
    if (!isTaskReport(report)) {
        return false;
    }
    const parentReport = report?.parentReportID ? getReport(report?.parentReportID, allReports) : undefined;
    return isPolicyExpenseChat(parentReport);
}

/**
 * Returns true if report has a parent
 */
function isThread(report: OnyxInputOrEntry<Report>): report is Thread {
    return !!(report?.parentReportID && report?.parentReportActionID);
}

/**
 * Returns true if report is of type chat and has a parent and is therefore a Thread.
 */
function isChatThread(report: OnyxInputOrEntry<Report>): report is Thread {
    return isThread(report) && report?.type === CONST.REPORT.TYPE.CHAT;
}

function isDM(report: OnyxEntry<Report>): boolean {
    return isChatReport(report) && !getChatType(report) && !isThread(report);
}

function isSelfDM(report: OnyxInputOrEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.SELF_DM;
}

function isGroupChat(report: OnyxEntry<Report> | Partial<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.GROUP;
}

/**
 * Only returns true if this is the Expensify DM report.
 *
 * Note that this chat is no longer used for new users. We still need this function for users who have this chat.
 */
function isSystemChat(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.SYSTEM;
}

function getDefaultNotificationPreferenceForReport(report: OnyxEntry<Report>): ValueOf<typeof CONST.REPORT.NOTIFICATION_PREFERENCE> {
    if (isAnnounceRoom(report)) {
        return CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS;
    }
    if (isPublicRoom(report)) {
        return CONST.REPORT.NOTIFICATION_PREFERENCE.DAILY;
    }
    if (!getChatType(report) || isGroupChat(report)) {
        return CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS;
    }
    if (isAdminRoom(report) || isPolicyExpenseChat(report) || isInvoiceRoom(report)) {
        return CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS;
    }
    if (isSelfDM(report)) {
        return CONST.REPORT.NOTIFICATION_PREFERENCE.MUTE;
    }
    return CONST.REPORT.NOTIFICATION_PREFERENCE.DAILY;
}

/**
 * Get the notification preference given a report. This should ALWAYS default to 'hidden'. Do not change this!
 */
function getReportNotificationPreference(report: OnyxEntry<Report>): ValueOf<typeof CONST.REPORT.NOTIFICATION_PREFERENCE> {
    const participant = currentUserAccountID ? report?.participants?.[currentUserAccountID] : undefined;
    return participant?.notificationPreference ?? CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN;
}

/**
 * Only returns true if this is our main 1:1 DM report with Concierge.
 */
function isConciergeChatReport(report: OnyxInputOrEntry<Report>): boolean {
    return !!report && report?.reportID === conciergeReportID;
}

function findSelfDMReportID(): string | undefined {
    if (!allReports) {
        return;
    }

    const selfDMReport = Object.values(allReports).find((report) => isSelfDM(report) && !isThread(report));
    return selfDMReport?.reportID;
}

/**
 * Checks if the supplied report is from a policy or is an invoice report from a policy
 */
function isPolicyRelatedReport(report: OnyxEntry<Report>, policyID?: string) {
    return report?.policyID === policyID || !!(report?.invoiceReceiver && 'policyID' in report.invoiceReceiver && report.invoiceReceiver.policyID === policyID);
}

/**
 * Checks if the supplied report belongs to workspace based on the provided params. If the report's policyID is _FAKE_ or has no value, it means this report is a DM.
 * In this case report and workspace members must be compared to determine whether the report belongs to the workspace.
 */
function doesReportBelongToWorkspace(report: OnyxEntry<Report>, policyMemberAccountIDs: number[], policyID?: string) {
    return (
        isConciergeChatReport(report) ||
        (report?.policyID === CONST.POLICY.ID_FAKE || !report?.policyID ? hasParticipantInArray(report, policyMemberAccountIDs) : isPolicyRelatedReport(report, policyID))
    );
}

/**
 * Given an array of reports, return them filtered by a policyID and policyMemberAccountIDs.
 */
function filterReportsByPolicyIDAndMemberAccountIDs(reports: Array<OnyxEntry<Report>>, policyMemberAccountIDs: number[] = [], policyID?: string) {
    return reports.filter((report) => !!report && doesReportBelongToWorkspace(report, policyMemberAccountIDs, policyID));
}

/**
 * Returns true if report is still being processed
 */
function isProcessingReport(report: OnyxEntry<Report>): boolean {
    return report?.stateNum === CONST.REPORT.STATE_NUM.SUBMITTED && report?.statusNum === CONST.REPORT.STATUS_NUM.SUBMITTED;
}

function isOpenReport(report: OnyxEntry<Report>): boolean {
    return report?.stateNum === CONST.REPORT.STATE_NUM.OPEN && report?.statusNum === CONST.REPORT.STATUS_NUM.OPEN;
}

function isAwaitingFirstLevelApproval(report: OnyxEntry<Report>): boolean {
    if (!report) {
        return false;
    }

    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const submitsToAccountID = getSubmitToAccountID(getPolicy(report.policyID), report);

    return isProcessingReport(report) && submitsToAccountID === report.managerID;
}

/**
 * Pushes optimistic transaction violations to OnyxData for the given policy and categories onyx update.
 *
 * @param policyUpdate Changed policy properties, if none pass empty object
 * @param policyCategoriesUpdate Changed categories properties, if none pass empty object
 */
function pushTransactionViolationsOnyxData(
    onyxData: OnyxData,
    policyID: string,
    policyTagLists: PolicyTagLists,
    policyCategories: PolicyCategories,
    allTransactionViolations: OnyxCollection<TransactionViolations>,
    policyUpdate: Partial<Policy> = {},
    policyCategoriesUpdate: Record<string, Partial<PolicyCategory>> = {},
): OnyxData {
    if (isEmptyObject(policyUpdate) && isEmptyObject(policyCategoriesUpdate)) {
        return onyxData;
    }
    const optimisticPolicyCategories = Object.keys(policyCategories).reduce<Record<string, PolicyCategory>>((acc, categoryName) => {
        acc[categoryName] = {...policyCategories[categoryName], ...(policyCategoriesUpdate?.[categoryName] ?? {})};
        return acc;
    }, {}) as PolicyCategories;

    const optimisticPolicy = {...allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`], ...policyUpdate} as Policy;
    const hasDependentTags = hasDependentTagsPolicyUtils(optimisticPolicy, policyTagLists);

    getAllPolicyReports(policyID).forEach((report) => {
        const isReportAnInvoice = isInvoiceReport(report);
        if (!report?.reportID || isReportAnInvoice) {
            return;
        }

        getReportTransactions(report.reportID).forEach((transaction: Transaction) => {
            const transactionViolations = allTransactionViolations?.[`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transaction.transactionID}`] ?? [];

            const optimisticTransactionViolations = ViolationsUtils.getViolationsOnyxData(
                transaction,
                transactionViolations,
                optimisticPolicy,
                policyTagLists,
                optimisticPolicyCategories,
                hasDependentTags,
                isReportAnInvoice,
            );

            if (optimisticTransactionViolations) {
                onyxData?.optimisticData?.push(optimisticTransactionViolations);
                onyxData?.failureData?.push({
                    onyxMethod: Onyx.METHOD.SET,
                    key: `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transaction.transactionID}`,
                    value: transactionViolations,
                });
            }
        });
    });
    return onyxData;
}

/**
 * Check if the report is a single chat report that isn't a thread
 * and personal detail of participant is optimistic data
 */
function shouldDisableDetailPage(report: OnyxEntry<Report>): boolean {
    if (isChatRoom(report) || isPolicyExpenseChat(report) || isChatThread(report) || isTaskReport(report)) {
        return false;
    }
    if (isOneOnOneChat(report)) {
        const participantAccountIDs = Object.keys(report?.participants ?? {})
            .map(Number)
            .filter((accountID) => accountID !== currentUserAccountID);
        return isOptimisticPersonalDetail(participantAccountIDs.at(0) ?? -1);
    }
    return false;
}

/**
 * Returns true if this report has only one participant and it's an Expensify account.
 */
function isExpensifyOnlyParticipantInReport(report: OnyxEntry<Report>): boolean {
    const otherParticipants = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserAccountID);
    return otherParticipants.length === 1 && otherParticipants.some((accountID) => CONST.EXPENSIFY_ACCOUNT_IDS.includes(accountID));
}

/**
 * Returns whether a given report can have tasks created in it.
 * We only prevent the task option if it's a DM/group-DM and the other users are all special Expensify accounts
 *
 */
function canCreateTaskInReport(report: OnyxEntry<Report>): boolean {
    const otherParticipants = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserAccountID);
    const areExpensifyAccountsOnlyOtherParticipants = otherParticipants.length >= 1 && otherParticipants.every((accountID) => CONST.EXPENSIFY_ACCOUNT_IDS.includes(accountID));
    if (areExpensifyAccountsOnlyOtherParticipants && isDM(report)) {
        return false;
    }

    return true;
}

/**
 * For all intents and purposes a report that has no notificationPreference at all should be considered "hidden".
 * We will remove the 'hidden' field entirely once the backend changes for https://github.com/Expensify/Expensify/issues/450891 are done.
 */
function isHiddenForCurrentUser(notificationPreference: string | null | undefined): boolean;
function isHiddenForCurrentUser(report: OnyxEntry<Report>): boolean;
function isHiddenForCurrentUser(reportOrPreference: OnyxEntry<Report> | string | null | undefined): boolean {
    if (typeof reportOrPreference === 'object' && reportOrPreference !== null) {
        const notificationPreference = getReportNotificationPreference(reportOrPreference);
        return isHiddenForCurrentUser(notificationPreference);
    }
    if (reportOrPreference === undefined || reportOrPreference === null || reportOrPreference === '') {
        return true;
    }
    return reportOrPreference === CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN;
}

/**
 * Returns true if there are any guides accounts (team.expensify.com) in a list of accountIDs
 * by cross-referencing the accountIDs with personalDetails since guides that are participants
 * of the user's chats should have their personal details in Onyx.
 */
function hasExpensifyGuidesEmails(accountIDs: number[]): boolean {
    return accountIDs.some((accountID) => Str.extractEmailDomain(allPersonalDetails?.[accountID]?.login ?? '') === CONST.EMAIL.GUIDES_DOMAIN);
}

function getMostRecentlyVisitedReport(reports: Array<OnyxEntry<Report>>, reportMetadata: OnyxCollection<ReportMetadata>): OnyxEntry<Report> {
    const filteredReports = reports.filter((report) => {
        const shouldKeep = !isChatThread(report) || !isHiddenForCurrentUser(report);
        return shouldKeep && !!report?.reportID && !!(reportMetadata?.[`${ONYXKEYS.COLLECTION.REPORT_METADATA}${report.reportID}`]?.lastVisitTime ?? report?.lastReadTime);
    });
    return lodashMaxBy(filteredReports, (a) => [reportMetadata?.[`${ONYXKEYS.COLLECTION.REPORT_METADATA}${a?.reportID}`]?.lastVisitTime ?? '', a?.lastReadTime ?? '']);
}

function findLastAccessedReport(ignoreDomainRooms: boolean, openOnAdminRoom = false, policyID?: string, excludeReportID?: string): OnyxEntry<Report> {
    // If it's the user's first time using New Expensify, then they could either have:
    //   - just a Concierge report, if so we'll return that
    //   - their Concierge report, and a separate report that must have deeplinked them to the app before they created their account.
    // If it's the latter, we'll use the deeplinked report over the Concierge report,
    // since the Concierge report would be incorrectly selected over the deep-linked report in the logic below.

    const policyMemberAccountIDs = getPolicyEmployeeListByIdWithoutCurrentUser(allPolicies, policyID, currentUserAccountID);

    let reportsValues = Object.values(allReports ?? {});

    if (!!policyID || policyMemberAccountIDs.length > 0) {
        reportsValues = filterReportsByPolicyIDAndMemberAccountIDs(reportsValues, policyMemberAccountIDs, policyID);
    }

    let adminReport: OnyxEntry<Report>;
    if (openOnAdminRoom) {
        adminReport = reportsValues.find((report) => {
            const chatType = getChatType(report);
            return chatType === CONST.REPORT.CHAT_TYPE.POLICY_ADMINS;
        });
    }
    if (adminReport) {
        return adminReport;
    }

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const shouldFilter = excludeReportID || ignoreDomainRooms;
    if (shouldFilter) {
        reportsValues = reportsValues.filter((report) => {
            if (excludeReportID && report?.reportID === excludeReportID) {
                return false;
            }

            // We allow public announce rooms, admins, and announce rooms through since we bypass the default rooms beta for them.
            // Check where findLastAccessedReport is called in MainDrawerNavigator.js for more context.
            // Domain rooms are now the only type of default room that are on the defaultRooms beta.
            if (ignoreDomainRooms && isDomainRoom(report) && !hasExpensifyGuidesEmails(Object.keys(report?.participants ?? {}).map(Number))) {
                return false;
            }

            return true;
        });
    }

    // Filter out the system chat (Expensify chat) because the composer is disabled in it,
    // and it prompts the user to use the Concierge chat instead.
    reportsValues =
        reportsValues.filter((report) => {
            // This will get removed as part of https://github.com/Expensify/App/issues/59961
            // eslint-disable-next-line deprecation/deprecation
            const reportNameValuePairs = getReportNameValuePairs(report?.reportID);

            return !isSystemChat(report) && !isArchivedReport(reportNameValuePairs);
        }) ?? [];

    // At least two reports remain: self DM and Concierge chat.
    // Return the most recently visited report. Get the last read report from the report metadata.
    // If allReportMetadata is empty we'll return most recent report owned by user
    if (isEmptyObject(allReportMetadata)) {
        const ownedReports = reportsValues.filter((report) => report?.ownerAccountID === currentUserAccountID);
        if (ownedReports.length > 0) {
            return lodashMaxBy(ownedReports, (a) => a?.lastReadTime ?? '');
        }
        return lodashMaxBy(reportsValues, (a) => a?.lastReadTime ?? '');
    }
    return getMostRecentlyVisitedReport(reportsValues, allReportMetadata);
}

/**
 * Whether the provided report has expenses
 */
function hasExpenses(reportID?: string, transactions?: SearchTransaction[] | Array<OnyxEntry<Transaction>>): boolean {
    if (transactions) {
        return !!transactions?.find((transaction) => transaction?.reportID === reportID);
    }
    return !!Object.values(allTransactions ?? {}).find((transaction) => transaction?.reportID === reportID);
}

/**
 * Whether the provided report is a closed expense report with no expenses
 */
function isClosedExpenseReportWithNoExpenses(report: OnyxEntry<Report>, transactions?: SearchTransaction[] | Array<OnyxEntry<Transaction>>): boolean {
    return report?.statusNum === CONST.REPORT.STATUS_NUM.CLOSED && isExpenseReport(report) && !hasExpenses(report.reportID, transactions);
}

/**
 * Whether the provided report is an archived room
 */
function isArchivedNonExpenseReport(report: OnyxInputOrEntry<Report> | SearchReport, isReportArchived = false): boolean {
    return isReportArchived && !(isExpenseReport(report) || isExpenseRequest(report));
}

/**
 * Whether the provided report is an archived report
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isArchivedReport(reportNameValuePairs?: OnyxInputOrEntry<ReportNameValuePairs>): boolean {
    return !!reportNameValuePairs?.private_isArchived;
}

/**
 * Whether the report with the provided reportID is an archived non-expense report
 */
function isArchivedNonExpenseReportWithID(report?: OnyxInputOrEntry<Report>, isReportArchived = false) {
    if (!report) {
        return false;
    }
    return !(isExpenseReport(report) || isExpenseRequest(report)) && isReportArchived;
}

/**
 * Whether the provided report is a closed report
 */
function isClosedReport(report: OnyxInputOrEntry<Report> | SearchReport): boolean {
    return report?.statusNum === CONST.REPORT.STATUS_NUM.CLOSED;
}
/**
 * Whether the provided report is the admin's room
 */
function isJoinRequestInAdminRoom(report: OnyxEntry<Report>): boolean {
    if (!report) {
        return false;
    }
    // If this policy isn't owned by Expensify,
    // Account manager/guide should not have the workspace join request pinned to their LHN,
    // since they are not a part of the company, and should not action it on their behalf.
    if (report.policyID) {
        // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
        // eslint-disable-next-line deprecation/deprecation
        const policy = getPolicy(report.policyID);
        if (!isExpensifyTeam(policy?.owner) && isExpensifyTeam(currentUserPersonalDetails?.login)) {
            return false;
        }
    }
    return isActionableJoinRequestPending(report.reportID);
}

/**
 * Checks if the user has auditor permission in the provided report
 */
function isAuditor(report: OnyxEntry<Report>): boolean {
    if (report?.policyID) {
        // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
        // eslint-disable-next-line deprecation/deprecation
        const policy = getPolicy(report.policyID);
        return isPolicyAuditor(policy);
    }

    if (Array.isArray(report?.permissions) && report?.permissions.length > 0) {
        return report?.permissions?.includes(CONST.REPORT.PERMISSIONS.AUDITOR);
    }

    return false;
}

/**
 * Checks if the user can write in the provided report
 */
function canWriteInReport(report: OnyxEntry<Report>): boolean {
    if (Array.isArray(report?.permissions) && report?.permissions.length > 0 && !report?.permissions?.includes(CONST.REPORT.PERMISSIONS.AUDITOR)) {
        return report?.permissions?.includes(CONST.REPORT.PERMISSIONS.WRITE);
    }

    return true;
}

/**
 * Checks if the current user is allowed to comment on the given report.
 */
function isAllowedToComment(report: OnyxEntry<Report>): boolean {
    if (!canWriteInReport(report)) {
        return false;
    }

    // Default to allowing all users to post
    const capability = report?.writeCapability ?? CONST.REPORT.WRITE_CAPABILITIES.ALL;

    if (capability === CONST.REPORT.WRITE_CAPABILITIES.ALL) {
        return true;
    }

    // If unauthenticated user opens public chat room using deeplink, they do not have policies available and they cannot comment
    if (!allPolicies) {
        return false;
    }

    // If we've made it here, commenting on this report is restricted.
    // If the user is an admin, allow them to post.
    const policy = allPolicies[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];
    return policy?.role === CONST.POLICY.ROLE.ADMIN;
}

/**
 * Checks if the current user is the admin of the policy given the policy expense chat.
 */
function isPolicyExpenseChatAdmin(report: OnyxEntry<Report>, policies: OnyxCollection<Policy>): boolean {
    if (!isPolicyExpenseChat(report)) {
        return false;
    }

    const policyRole = policies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]?.role;

    return policyRole === CONST.POLICY.ROLE.ADMIN;
}

/**
 * Checks if the current user is the admin of the policy.
 */
function isPolicyAdmin(policyID: string | undefined, policies: OnyxCollection<Policy>): boolean {
    if (!policyID) {
        return false;
    }

    const policyRole = policies?.[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`]?.role;

    return policyRole === CONST.POLICY.ROLE.ADMIN;
}

/**
 * Checks whether all the transactions linked to the IOU report are of the Distance Request type with pending routes
 */
function hasOnlyTransactionsWithPendingRoutes(iouReportID: string | undefined): boolean {
    const transactions = getReportTransactions(iouReportID);

    // Early return false in case not having any transaction
    if (!transactions || transactions.length === 0) {
        return false;
    }

    return transactions.every((transaction) => isFetchingWaypointsFromServer(transaction));
}

/**
 * If the report is a thread and has a chat type set, it is a expense chat.
 */
function isWorkspaceThread(report: OnyxEntry<Report>): boolean {
    const chatType = getChatType(report);
    return isThread(report) && isChatReport(report) && CONST.WORKSPACE_ROOM_TYPES.some((type) => chatType === type);
}

/**
 * Checks if a report is a child report.
 */
function isChildReport(report: OnyxEntry<Report>): boolean {
    return isThread(report) || isTaskReport(report);
}

/**
 * An Expense Request is a thread where the parent report is an Expense Report and
 * the parentReportAction is a transaction.
 */
function isExpenseRequest(report: OnyxInputOrEntry<Report>): report is Thread {
    if (isThread(report)) {
        const parentReportAction = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.parentReportID}`]?.[report.parentReportActionID];
        const parentReport = getReport(report?.parentReportID, allReports);
        return isExpenseReport(parentReport) && !isEmptyObject(parentReportAction) && isTransactionThread(parentReportAction);
    }
    return false;
}

/**
 * An IOU Request is a thread where the parent report is an IOU Report and
 * the parentReportAction is a transaction.
 */
function isIOURequest(report: OnyxInputOrEntry<Report>): boolean {
    if (isThread(report)) {
        const parentReportAction = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.parentReportID}`]?.[report.parentReportActionID];
        const parentReport = getReport(report?.parentReportID, allReports);
        return isIOUReport(parentReport) && !isEmptyObject(parentReportAction) && isTransactionThread(parentReportAction);
    }
    return false;
}

/**
 * A Track Expense Report is a thread where the parent the parentReportAction is a transaction, and
 * parentReportAction has type of track.
 */
function isTrackExpenseReport(report: OnyxInputOrEntry<Report>): boolean {
    if (isThread(report)) {
        const selfDMReportID = findSelfDMReportID();
        const parentReportAction = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.parentReportID}`]?.[report.parentReportActionID];
        return !isEmptyObject(parentReportAction) && selfDMReportID === report.parentReportID && isTrackExpenseAction(parentReportAction);
    }
    return false;
}

/**
 * Checks if a report is an IOU or expense request.
 */
function isMoneyRequest(reportOrID: OnyxEntry<Report> | string): boolean {
    const report = typeof reportOrID === 'string' ? (getReport(reportOrID, allReports) ?? null) : reportOrID;
    return isIOURequest(report) || isExpenseRequest(report);
}

/**
 * Checks if a report is an IOU or expense report.
 */
function isMoneyRequestReport(reportOrID: OnyxInputOrEntry<Report> | SearchReport | string, reports?: SearchReport[] | OnyxCollection<Report>): boolean {
    const report = typeof reportOrID === 'string' ? (getReport(reportOrID, reports ?? allReports) ?? null) : reportOrID;
    return isIOUReport(report) || isExpenseReport(report);
}

/**
 * Determines the Help Panel report type based on the given report.
 */
function getHelpPaneReportType(report: OnyxEntry<Report>): ValueOf<typeof CONST.REPORT.HELP_TYPE> | undefined {
    if (!report) {
        return undefined;
    }

    if (isConciergeChatReport(report)) {
        return CONST.REPORT.HELP_TYPE.CHAT_CONCIERGE;
    }

    if (report?.chatType) {
        return getChatType(report);
    }

    switch (report?.type) {
        case CONST.REPORT.TYPE.EXPENSE:
            return CONST.REPORT.HELP_TYPE.EXPENSE_REPORT;
        case CONST.REPORT.TYPE.CHAT:
            return CONST.REPORT.HELP_TYPE.CHAT;
        case CONST.REPORT.TYPE.IOU:
            return CONST.REPORT.HELP_TYPE.IOU;
        case CONST.REPORT.TYPE.INVOICE:
            return CONST.REPORT.HELP_TYPE.INVOICE;
        case CONST.REPORT.TYPE.TASK:
            return CONST.REPORT.HELP_TYPE.TASK;
        default:
            return undefined;
    }
}

/**
 * Checks if a report contains only Non-Reimbursable transactions
 */
function hasOnlyNonReimbursableTransactions(iouReportID: string | undefined): boolean {
    const transactions = getReportTransactions(iouReportID);
    if (!transactions || transactions.length === 0) {
        return false;
    }

    return transactions.every((transaction) => !getReimbursable(transaction));
}

/**
 * Checks if a report has only one transaction associated with it
 */
function isOneTransactionReport(report: OnyxEntry<Report>): boolean {
    const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report?.reportID}`] ?? ([] as ReportAction[]);
    const chatReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.chatReportID}`];
    return !!getOneTransactionThreadReportID(report, chatReport, reportActions);
}

/*
 * Whether the report contains only one expense and the expense should be paid later
 */
function isPayAtEndExpenseReport(report: OnyxEntry<Report>, transactions: Transaction[] | undefined): boolean {
    if ((!!transactions && transactions.length !== 1) || !isOneTransactionReport(report)) {
        return false;
    }

    return isPayAtEndExpense(transactions?.[0] ?? getReportTransactions(report?.reportID).at(0));
}
/**
 * Checks if a report is a transaction thread associated with a report that has only one transaction
 */
function isOneTransactionThread(report: OnyxEntry<Report>, parentReport: OnyxEntry<Report>, threadParentReportAction: OnyxEntry<ReportAction>) {
    if (!report || !parentReport) {
        return false;
    }

    const parentReportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${parentReport?.reportID}`] ?? ([] as ReportAction[]);

    const chatReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${parentReport?.chatReportID}`];
    const transactionThreadReportID = getOneTransactionThreadReportID(parentReport, chatReport, parentReportActions);
    return report?.reportID === transactionThreadReportID && !isSentMoneyReportAction(threadParentReportAction);
}

/**
 * Checks if given report is a transaction thread
 */
function isReportTransactionThread(report: OnyxEntry<Report>) {
    return isMoneyRequest(report) || isTrackExpenseReport(report);
}

/**
 * Get displayed report ID, it will be parentReportID if the report is one transaction thread
 */
function getDisplayedReportID(reportID: string): string {
    const report = getReport(reportID, allReports);
    const parentReportID = report?.parentReportID;
    const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${parentReportID}`];
    const parentReportAction = getReportAction(parentReportID, report?.parentReportActionID);
    return parentReportID && isOneTransactionThread(report, parentReport, parentReportAction) ? parentReportID : reportID;
}

/**
 * Should return true only for personal 1:1 report
 *
 */
function isOneOnOneChat(report: OnyxEntry<Report>): boolean {
    const participants = report?.participants ?? {};
    const participant = currentUserAccountID ? participants[currentUserAccountID] : undefined;
    const isCurrentUserParticipant = participant ? 1 : 0;
    const participantAmount = Object.keys(participants).length - isCurrentUserParticipant;
    if (participantAmount !== 1) {
        return false;
    }
    return (
        (report?.policyID === CONST.POLICY.ID_FAKE || !report?.policyID) &&
        !isChatRoom(report) &&
        !isExpenseRequest(report) &&
        !isMoneyRequestReport(report) &&
        !isPolicyExpenseChat(report) &&
        !isTaskReport(report) &&
        isDM(report) &&
        !isIOUReport(report)
    );
}

/**
 * Checks if the current user is a payer of the expense
 */

function isPayer(session: OnyxEntry<Session>, iouReport: OnyxEntry<Report>, onlyShowPayElsewhere = false, reportPolicy?: OnyxInputOrEntry<Policy> | SearchPolicy) {
    const isApproved = isReportApproved({report: iouReport});
    const policy = reportPolicy ?? allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${iouReport?.policyID}`] ?? null;
    const policyType = policy?.type;
    const isAdmin = policyType !== CONST.POLICY.TYPE.PERSONAL && policy?.role === CONST.POLICY.ROLE.ADMIN;
    const isManager = iouReport?.managerID === session?.accountID;
    if (isPaidGroupPolicy(iouReport)) {
        if (policy?.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_YES) {
            // If we get here without a reimburser only show the pay button if we are the admin.
            if (!policy?.achAccount?.reimburser) {
                return isAdmin;
            }

            // If we are the reimburser and the report is approved or we are the manager then we can pay it.
            const isReimburser = session?.email === policy?.achAccount?.reimburser;
            return isReimburser && (isApproved || isManager);
        }
        if (policy?.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_MANUAL || onlyShowPayElsewhere) {
            return isAdmin && (isApproved || isManager);
        }
        return false;
    }
    return isAdmin || (isMoneyRequestReport(iouReport) && isManager);
}

/**
 * Checks if the current user is the action's author
 */
function isActionCreator(reportAction: OnyxInputOrEntry<ReportAction> | Partial<ReportAction>): boolean {
    return reportAction?.actorAccountID === currentUserAccountID;
}

/**
 * Returns the notification preference of the action's child report if it exists.
 * Otherwise, calculates it based on the action's authorship.
 */
function getChildReportNotificationPreference(reportAction: OnyxInputOrEntry<ReportAction> | Partial<ReportAction>): NotificationPreference {
    const childReportNotificationPreference = reportAction?.childReportNotificationPreference ?? '';
    if (childReportNotificationPreference) {
        return childReportNotificationPreference;
    }

    return isActionCreator(reportAction) ? CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS : CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN;
}

function canAddOrDeleteTransactions(moneyRequestReport: OnyxEntry<Report>, isReportArchived = false): boolean {
    if (!isMoneyRequestReport(moneyRequestReport) || isReportArchived) {
        return false;
    }
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(moneyRequestReport?.policyID);

    if (isInstantSubmitEnabled(policy) && isSubmitAndClose(policy) && !arePaymentsEnabled(policy)) {
        return false;
    }

    if (isInstantSubmitEnabled(policy) && isProcessingReport(moneyRequestReport)) {
        return isAwaitingFirstLevelApproval(moneyRequestReport);
    }

    if (isReportApproved({report: moneyRequestReport}) || isClosedReport(moneyRequestReport) || isSettled(moneyRequestReport?.reportID)) {
        return false;
    }

    return true;
}

/**
 * Checks whether the supplied report supports adding more transactions to it.
 * Return true if:
 * - report is a non-settled IOU
 * - report is a draft
 * Returns false if:
 * - if current user is not the submitter of an expense report
 */
function canAddTransaction(moneyRequestReport: OnyxEntry<Report>, isReportArchived = false): boolean {
    if (!isMoneyRequestReport(moneyRequestReport) || (isExpenseReport(moneyRequestReport) && !isCurrentUserSubmitter(moneyRequestReport))) {
        return false;
    }
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(moneyRequestReport?.policyID);
    if (isInstantSubmitEnabled(policy) && isSubmitAndClose(policy) && hasOnlyNonReimbursableTransactions(moneyRequestReport?.reportID)) {
        return false;
    }

    return canAddOrDeleteTransactions(moneyRequestReport, isReportArchived);
}

/**
 * Checks whether the supplied report supports deleting more transactions from it.
 * Return true if:
 * - report is a non-settled IOU
 * - report is a non-approved IOU
 */
function canDeleteTransaction(moneyRequestReport: OnyxEntry<Report>, isReportArchived = false): boolean {
    return canAddOrDeleteTransactions(moneyRequestReport, isReportArchived);
}

/**
 * Checks whether the card transaction support deleting based on liability type
 */
function canDeleteCardTransactionByLiabilityType(transaction: OnyxEntry<Transaction>): boolean {
    const isCardTransaction = isCardTransactionTransactionUtils(transaction);
    if (!isCardTransaction) {
        return true;
    }
    return transaction?.comment?.liabilityType === CONST.TRANSACTION.LIABILITY_TYPE.ALLOW;
}

/**
 * Can only delete if the author is this user and the action is an ADD_COMMENT action or an IOU action in an unsettled report, or if the user is a
 * policy admin
 */
function canDeleteReportAction(reportAction: OnyxInputOrEntry<ReportAction>, reportID: string | undefined, transaction: OnyxEntry<Transaction> | undefined): boolean {
    const report = getReportOrDraftReport(reportID);
    const isActionOwner = reportAction?.actorAccountID === currentUserAccountID;
    const policy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`] ?? null;

    if (isDemoTransaction(transaction)) {
        return true;
    }

    if (isMoneyRequestAction(reportAction)) {
        const isCardTransactionCanBeDeleted = canDeleteCardTransactionByLiabilityType(transaction);
        // For now, users cannot delete split actions
        const isSplitAction = getOriginalMessage(reportAction)?.type === CONST.IOU.REPORT_ACTION_TYPE.SPLIT;

        if (isSplitAction) {
            return false;
        }

        if (isActionOwner) {
            if (!isEmptyObject(report) && (isMoneyRequestReport(report) || isInvoiceReport(report))) {
                return canDeleteTransaction(report) && isCardTransactionCanBeDeleted;
            }
            return true;
        }
    }

    if (
        reportAction?.actionName !== CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT ||
        reportAction?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE ||
        isCreatedTaskReportAction(reportAction) ||
        reportAction?.actorAccountID === CONST.ACCOUNT_ID.CONCIERGE
    ) {
        return false;
    }

    const isAdmin = policy?.role === CONST.POLICY.ROLE.ADMIN && !isEmptyObject(report) && !isDM(report);

    return isActionOwner || isAdmin;
}

/**
 * Returns true if Concierge is one of the chat participants (1:1 as well as group chats)
 */
function chatIncludesConcierge(report: Partial<OnyxEntry<Report>>): boolean {
    const participantAccountIDs = Object.keys(report?.participants ?? {}).map(Number);
    return participantAccountIDs.includes(CONST.ACCOUNT_ID.CONCIERGE);
}

/**
 * Returns true if there is any automated expensify account `in accountIDs
 */
function hasAutomatedExpensifyAccountIDs(accountIDs: number[]): boolean {
    return accountIDs.some((accountID) => CONST.EXPENSIFY_ACCOUNT_IDS.includes(accountID));
}

function getReportRecipientAccountIDs(report: OnyxEntry<Report>, currentLoginAccountID: number): number[] {
    let finalReport: OnyxEntry<Report> = report;
    // In 1:1 chat threads, the participants will be the same as parent report. If a report is specifically a 1:1 chat thread then we will
    // get parent report and use its participants array.
    if (isThread(report) && !(isTaskReport(report) || isMoneyRequestReport(report))) {
        const parentReport = getReport(report?.parentReportID, allReports);
        if (isOneOnOneChat(parentReport)) {
            finalReport = parentReport;
        }
    }

    let finalParticipantAccountIDs: number[] = [];
    if (isTaskReport(report)) {
        // Task reports `managerID` will change when assignee is changed, in that case the old `managerID` is still present in `participants`
        // along with the new one. We only need the `managerID` as a participant here.
        finalParticipantAccountIDs = report?.managerID ? [report?.managerID] : [];
    } else {
        finalParticipantAccountIDs = Object.keys(finalReport?.participants ?? {}).map(Number);
    }

    const otherParticipantsWithoutExpensifyAccountIDs = finalParticipantAccountIDs.filter((accountID) => {
        if (accountID === currentLoginAccountID) {
            return false;
        }
        if (CONST.EXPENSIFY_ACCOUNT_IDS.includes(accountID)) {
            return false;
        }
        return true;
    });

    return otherParticipantsWithoutExpensifyAccountIDs;
}

/**
 * Whether the time row should be shown for a report.
 */
function canShowReportRecipientLocalTime(personalDetails: OnyxEntry<PersonalDetailsList>, report: OnyxEntry<Report>, accountID: number): boolean {
    const reportRecipientAccountIDs = getReportRecipientAccountIDs(report, accountID);
    const hasMultipleParticipants = reportRecipientAccountIDs.length > 1;
    const reportRecipient = personalDetails?.[reportRecipientAccountIDs[0]];
    const reportRecipientTimezone = reportRecipient?.timezone ?? CONST.DEFAULT_TIME_ZONE;
    const isReportParticipantValidated = reportRecipient?.validated ?? false;
    return !!(
        !hasMultipleParticipants &&
        !isChatRoom(report) &&
        !isPolicyExpenseChat(getRootParentReport({report})) &&
        reportRecipient &&
        reportRecipientTimezone?.selected &&
        isReportParticipantValidated
    );
}

/**
 * Shorten last message text to fixed length and trim spaces.
 */
function formatReportLastMessageText(lastMessageText: string | undefined, isModifiedExpenseMessage = false): string {
    if (isModifiedExpenseMessage) {
        return String(lastMessageText).trim().replace(CONST.REGEX.LINE_BREAK, '').trim();
    }

    return formatLastMessageText(lastMessageText);
}

/**
 * Helper method to return the default avatar associated with the given login
 */
function getDefaultWorkspaceAvatar(workspaceName?: string): React.FC<SvgProps> {
    if (!workspaceName) {
        return defaultWorkspaceAvatars.WorkspaceBuilding;
    }

    // Remove all chars not A-Z or 0-9 including underscore
    const alphaNumeric = workspaceName
        .normalize('NFD')
        .replace(/[^0-9a-z]/gi, '')
        .toUpperCase();

    const workspace = `Workspace${alphaNumeric[0]}` as keyof typeof defaultWorkspaceAvatars;
    const defaultWorkspaceAvatar = defaultWorkspaceAvatars[workspace];

    return !alphaNumeric ? defaultWorkspaceAvatars.WorkspaceBuilding : defaultWorkspaceAvatar;
}

/**
 * Helper method to return the default avatar testID associated with the given login
 */
function getDefaultWorkspaceAvatarTestID(workspaceName: string): string {
    if (!workspaceName) {
        return defaultAvatarBuildingIconTestID;
    }

    // Remove all chars not A-Z or 0-9 including underscore
    const alphaNumeric = workspaceName
        .normalize('NFD')
        .replace(/[^0-9a-z]/gi, '')
        .toLowerCase();

    return !alphaNumeric ? defaultAvatarBuildingIconTestID : `SvgDefaultAvatar_${alphaNumeric[0]} Icon`;
}

/**
 * Helper method to return the default avatar associated with the given reportID
 */
function getDefaultGroupAvatar(reportID?: string): IconAsset {
    if (!reportID) {
        return defaultGroupAvatars.Avatar1;
    }
    const reportIDHashBucket: AvatarRange = ((Number(reportID) % CONST.DEFAULT_GROUP_AVATAR_COUNT) + 1) as AvatarRange;
    return defaultGroupAvatars[`Avatar${reportIDHashBucket}`];
}

/**
 * Returns the appropriate icons for the given chat report using the stored personalDetails.
 * The Avatar sources can be URLs or Icon components according to the chat type.
 */
function getIconsForParticipants(participants: number[], personalDetails: OnyxInputOrEntry<PersonalDetailsList>): Icon[] {
    const participantDetails: ParticipantDetails[] = [];
    const participantsList = participants || [];

    for (const accountID of participantsList) {
        const avatarSource = personalDetails?.[accountID]?.avatar ?? FallbackAvatar;
        const displayNameLogin = personalDetails?.[accountID]?.displayName ? personalDetails?.[accountID]?.displayName : personalDetails?.[accountID]?.login;
        participantDetails.push([accountID, displayNameLogin ?? '', avatarSource, personalDetails?.[accountID]?.fallbackIcon ?? '']);
    }

    const sortedParticipantDetails = participantDetails.sort((first, second) => {
        // First sort by displayName/login
        const displayNameLoginOrder = localeCompare(first[1], second[1]);
        if (displayNameLoginOrder !== 0) {
            return displayNameLoginOrder;
        }

        // Then fallback on accountID as the final sorting criteria.
        // This will ensure that the order of avatars with same login/displayName
        // stay consistent across all users and devices
        return first[0] - second[0];
    });

    // Now that things are sorted, gather only the avatars (second element in the array) and return those
    const avatars: Icon[] = [];

    for (const sortedParticipantDetail of sortedParticipantDetails) {
        const userIcon = {
            id: sortedParticipantDetail[0],
            source: sortedParticipantDetail[2],
            type: CONST.ICON_TYPE_AVATAR,
            name: sortedParticipantDetail[1],
            fallbackIcon: sortedParticipantDetail[3],
        };
        avatars.push(userIcon);
    }

    return avatars;
}

/**
 * Cache the workspace icons
 */
const workSpaceIconsCache = new Map<string, {name: string; icon: Icon}>();

/**
 * Given a report, return the associated workspace icon.
 */
function getWorkspaceIcon(report: OnyxInputOrEntry<Report>, policy?: OnyxInputOrEntry<Policy>): Icon {
    const workspaceName = getPolicyName({report, policy});
    const cacheKey = report?.policyID ?? workspaceName;
    const iconFromCache = workSpaceIconsCache.get(cacheKey);
    const reportPolicy = policy ?? allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];
    const policyAvatarURL = reportPolicy ? reportPolicy?.avatarURL : report?.policyAvatar;
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const policyExpenseChatAvatarSource = policyAvatarURL || getDefaultWorkspaceAvatar(workspaceName);

    const isSameAvatarURL = iconFromCache?.icon?.source === policyExpenseChatAvatarSource;
    const hasWorkSpaceNameChanged = iconFromCache?.name !== workspaceName;

    if (iconFromCache && (isSameAvatarURL || policyAvatarURL === undefined) && !hasWorkSpaceNameChanged) {
        return iconFromCache.icon;
    }

    const workspaceIcon: Icon = {
        source: policyExpenseChatAvatarSource ?? '',
        type: CONST.ICON_TYPE_WORKSPACE,
        name: workspaceName,
        id: report?.policyID,
    };
    workSpaceIconsCache.set(cacheKey, {name: workspaceName, icon: workspaceIcon});
    return workspaceIcon;
}

/**
 * Gets the personal details for a login by looking in the ONYXKEYS.PERSONAL_DETAILS_LIST Onyx key (stored in the local variable, allPersonalDetails). If it doesn't exist in Onyx,
 * then a default object is constructed.
 */
function getPersonalDetailsForAccountID(accountID: number | undefined, personalDetailsData?: Partial<PersonalDetailsList>): Partial<PersonalDetails> {
    if (!accountID) {
        return {};
    }

    const defaultDetails = {
        isOptimisticPersonalDetail: true,
    };

    if (!personalDetailsData) {
        return allPersonalDetails?.[accountID] ?? defaultDetails;
    }

    return personalDetailsData?.[accountID] ?? defaultDetails;
}

/**
 * Returns the personal details or a default object if the personal details are not available.
 */
function getPersonalDetailsOrDefault(personalDetails: Partial<PersonalDetails> | undefined | null): Partial<PersonalDetails> {
    return personalDetails ?? {isOptimisticPersonalDetail: true};
}

const phoneNumberCache: Record<string, string> = {};

/**
 * Get the displayName for a single report participant.
 */
function getDisplayNameForParticipant({
    accountID,
    shouldUseShortForm = false,
    shouldFallbackToHidden = true,
    shouldAddCurrentUserPostfix = false,
    personalDetailsData = allPersonalDetails,
    shouldRemoveDomain = false,
}: {
    accountID?: number;
    shouldUseShortForm?: boolean;
    shouldFallbackToHidden?: boolean;
    shouldAddCurrentUserPostfix?: boolean;
    personalDetailsData?: Partial<PersonalDetailsList>;
    shouldRemoveDomain?: boolean;
}): string {
    if (!accountID) {
        return '';
    }

    const personalDetails = getPersonalDetailsOrDefault(personalDetailsData?.[accountID]);
    if (!personalDetails) {
        return '';
    }

    const login = personalDetails.login ?? '';

    // Check if the phone number is already cached
    let formattedLogin = phoneNumberCache[login];
    if (!formattedLogin) {
        formattedLogin = formatPhoneNumber(login);
        // Store the formatted phone number in the cache
        phoneNumberCache[login] = formattedLogin;
    }

    // This is to check if account is an invite/optimistically created one
    // and prevent from falling back to 'Hidden', so a correct value is shown
    // when searching for a new user
    if (personalDetails.isOptimisticPersonalDetail === true) {
        return formattedLogin;
    }

    // For selfDM, we display the user's displayName followed by '(you)' as a postfix
    const shouldAddPostfix = shouldAddCurrentUserPostfix && accountID === currentUserAccountID;

    let longName = getDisplayNameOrDefault(personalDetails, formattedLogin, shouldFallbackToHidden, shouldAddPostfix);

    if (shouldRemoveDomain && longName === formattedLogin) {
        longName = longName.split('@').at(0) ?? '';
    }

    // If the user's personal details (first name) should be hidden, make sure we return "hidden" instead of the short name
    if (shouldFallbackToHidden && longName === hiddenTranslation) {
        return formatPhoneNumber(longName);
    }

    const shortName = personalDetails.firstName ? personalDetails.firstName : longName;
    return shouldUseShortForm ? shortName : longName;
}

function getParticipantsAccountIDsForDisplay(
    report: OnyxEntry<Report>,
    shouldExcludeHidden = false,
    shouldExcludeDeleted = false,
    shouldForceExcludeCurrentUser = false,
    reportMetadataParam?: OnyxEntry<ReportMetadata>,
): number[] {
    const reportParticipants = report?.participants ?? {};
    const reportMetadata = reportMetadataParam ?? getReportMetadata(report?.reportID);
    let participantsEntries = Object.entries(reportParticipants);

    // We should not show participants that have an optimistic entry with the same login in the personal details
    const nonOptimisticLoginMap: Record<string, boolean | undefined> = {};

    for (const entry of participantsEntries) {
        const [accountID] = entry;
        const personalDetail = allPersonalDetails?.[accountID];
        if (personalDetail?.login && !personalDetail.isOptimisticPersonalDetail) {
            nonOptimisticLoginMap[personalDetail.login] = true;
        }
    }

    participantsEntries = participantsEntries.filter(([accountID]) => {
        const personalDetail = allPersonalDetails?.[accountID];
        if (personalDetail?.login && personalDetail.isOptimisticPersonalDetail) {
            return !nonOptimisticLoginMap[personalDetail.login];
        }
        return true;
    });

    let participantsIds = participantsEntries.map(([accountID]) => Number(accountID));

    // For 1:1 chat, we don't want to include the current user as a participant in order to not mark 1:1 chats as having multiple participants
    // For system chat, we want to display Expensify as the only participant
    const shouldExcludeCurrentUser = isOneOnOneChat(report) || isSystemChat(report) || shouldForceExcludeCurrentUser;

    if (shouldExcludeCurrentUser || shouldExcludeHidden || shouldExcludeDeleted) {
        participantsIds = participantsIds.filter((accountID) => {
            if (shouldExcludeCurrentUser && accountID === currentUserAccountID) {
                return false;
            }

            if (shouldExcludeHidden && isHiddenForCurrentUser(reportParticipants[accountID]?.notificationPreference)) {
                return false;
            }

            if (
                shouldExcludeDeleted &&
                reportMetadata?.pendingChatMembers?.findLast((member) => Number(member.accountID) === accountID)?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE
            ) {
                return false;
            }

            return true;
        });
    }

    return participantsIds.filter((accountID) => isNumber(accountID));
}

function getParticipantsList(report: Report, personalDetails: OnyxEntry<PersonalDetailsList>, isRoomMembersList = false, reportMetadata: OnyxEntry<ReportMetadata> = undefined): number[] {
    const isReportGroupChat = isGroupChat(report);
    const shouldExcludeHiddenParticipants = !isReportGroupChat && !isInvoiceReport(report) && !isMoneyRequestReport(report) && !isMoneyRequest(report);
    const chatParticipants = getParticipantsAccountIDsForDisplay(report, isRoomMembersList || shouldExcludeHiddenParticipants, false, false, reportMetadata);

    return chatParticipants.filter((accountID) => {
        const details = personalDetails?.[accountID];

        if (!isRoomMembersList) {
            if (!details) {
                Log.hmmm(`[ReportParticipantsPage] no personal details found for Group chat member with accountID: ${accountID}`);
                return false;
            }
        } else {
            // When adding a new member to a room (whose personal detail does not exist in Onyx), an optimistic personal detail
            // is created. However, when the real personal detail is returned from the backend, a duplicate member may appear
            // briefly before the optimistic personal detail is deleted. To address this, we filter out the optimistically created
            // member here.
            const isDuplicateOptimisticDetail =
                details?.isOptimisticPersonalDetail && chatParticipants.some((accID) => accID !== accountID && details.login === personalDetails?.[accID]?.login);

            if (!details || isDuplicateOptimisticDetail) {
                Log.hmmm(`[RoomMembersPage] no personal details found for room member with accountID: ${accountID}`);
                return false;
            }
        }
        return true;
    });
}

function buildParticipantsFromAccountIDs(accountIDs: number[]): Participants {
    const finalParticipants: Participants = {};
    return accountIDs.reduce((participants, accountID) => {
        // eslint-disable-next-line no-param-reassign
        participants[accountID] = {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS};
        return participants;
    }, finalParticipants);
}

/**
 * Returns the report name if the report is a group chat
 */
function getGroupChatName(participants?: SelectedParticipant[], shouldApplyLimit = false, report?: OnyxEntry<Report>, reportMetadataParam?: OnyxEntry<ReportMetadata>): string | undefined {
    // If we have a report always try to get the name from the report.
    if (report?.reportName) {
        return report.reportName;
    }

    const reportMetadata = reportMetadataParam ?? getReportMetadata(report?.reportID);

    const pendingMemberAccountIDs = new Set(
        reportMetadata?.pendingChatMembers?.filter((member) => member.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE).map((member) => member.accountID),
    );
    let participantAccountIDs =
        participants?.map((participant) => participant.accountID) ??
        Object.keys(report?.participants ?? {})
            .map(Number)
            .filter((accountID) => !pendingMemberAccountIDs.has(accountID.toString()));
    const shouldAddEllipsis = participantAccountIDs.length > CONST.DISPLAY_PARTICIPANTS_LIMIT && shouldApplyLimit;
    if (shouldApplyLimit) {
        participantAccountIDs = participantAccountIDs.slice(0, CONST.DISPLAY_PARTICIPANTS_LIMIT);
    }
    const isMultipleParticipantReport = participantAccountIDs.length > 1;

    if (isMultipleParticipantReport) {
        return participantAccountIDs
            .map(
                (participantAccountID, index) =>
                    getDisplayNameForParticipant({accountID: participantAccountID, shouldUseShortForm: isMultipleParticipantReport}) || formatPhoneNumber(participants?.[index]?.login ?? ''),
            )
            .sort((first, second) => localeCompare(first ?? '', second ?? ''))
            .filter(Boolean)
            .join(', ')
            .slice(0, CONST.REPORT_NAME_LIMIT)
            .concat(shouldAddEllipsis ? '...' : '');
    }

    return translateLocal('groupChat.defaultReportName', {displayName: getDisplayNameForParticipant({accountID: participantAccountIDs.at(0)})});
}

function getParticipants(reportID: string) {
    const report = getReportOrDraftReport(reportID);
    if (!report) {
        return {};
    }

    return report.participants;
}

function getParticipantIcon(accountID: number | undefined, personalDetails: OnyxInputOrEntry<PersonalDetailsList>, shouldUseShortForm = false): Icon {
    if (!accountID) {
        return {
            id: CONST.DEFAULT_NUMBER_ID,
            source: FallbackAvatar,
            type: CONST.ICON_TYPE_AVATAR,
            name: '',
        };
    }
    const details = personalDetails?.[accountID];
    const displayName = getDisplayNameOrDefault(details, '', shouldUseShortForm);

    return {
        id: accountID,
        source: details?.avatar ?? FallbackAvatar,
        type: CONST.ICON_TYPE_AVATAR,
        name: displayName,
        fallbackIcon: details?.fallbackIcon,
    };
}

/**
 * Helper function to get the icons for the invoice receiver. Only to be used in getIcons().
 */
function getInvoiceReceiverIcons(report: OnyxInputOrEntry<Report>, personalDetails: OnyxInputOrEntry<PersonalDetailsList>, invoiceReceiverPolicy: OnyxInputOrEntry<Policy>): Icon[] {
    if (report?.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL) {
        return getIconsForParticipants([report?.invoiceReceiver.accountID], personalDetails);
    }

    const receiverPolicyID = report?.invoiceReceiver?.policyID;

    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const receiverPolicy = invoiceReceiverPolicy ?? getPolicy(receiverPolicyID);
    if (!isEmptyObject(receiverPolicy)) {
        return [
            {
                source: receiverPolicy?.avatarURL ?? getDefaultWorkspaceAvatar(receiverPolicy.name),
                type: CONST.ICON_TYPE_WORKSPACE,
                name: receiverPolicy.name,
                id: receiverPolicyID,
            },
        ];
    }
    return [];
}

/**
 * Helper function to get the icons for an expense request. Only to be used in getIcons().
 */
function getIconsForExpenseRequest(report: OnyxInputOrEntry<Report>, personalDetails: OnyxInputOrEntry<PersonalDetailsList>, policy: OnyxInputOrEntry<Policy>): Icon[] {
    if (!report || !report?.parentReportID || !report?.parentReportActionID) {
        return [];
    }
    const parentReportAction = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.parentReportID}`]?.[report.parentReportActionID];
    const workspaceIcon = getWorkspaceIcon(report, policy);
    const actorDetails = parentReportAction?.actorAccountID ? personalDetails?.[parentReportAction.actorAccountID] : undefined;
    const memberIcon = {
        source: actorDetails?.avatar ?? FallbackAvatar,
        id: parentReportAction?.actorAccountID,
        type: CONST.ICON_TYPE_AVATAR,
        name: actorDetails?.displayName ?? '',
        fallbackIcon: actorDetails?.fallbackIcon,
    };
    return [memberIcon, workspaceIcon];
}

/**
 * Helper function to get the icons for a chat thread. Only to be used in getIcons().
 */
function getIconsForChatThread(report: OnyxInputOrEntry<Report>, personalDetails: OnyxInputOrEntry<PersonalDetailsList>, policy: OnyxInputOrEntry<Policy>): Icon[] {
    if (!report || !report?.parentReportID || !report?.parentReportActionID) {
        return [];
    }
    const parentReportAction = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.parentReportID}`]?.[report.parentReportActionID];
    const actorAccountID = getReportActionActorAccountID(parentReportAction, report as OnyxEntry<Report>, report as OnyxEntry<Report>);
    const actorDetails = actorAccountID ? personalDetails?.[actorAccountID] : undefined;
    const actorDisplayName = getDisplayNameOrDefault(actorDetails, '', false);
    const actorIcon = {
        id: actorAccountID,
        source: actorDetails?.avatar ?? FallbackAvatar,
        name: formatPhoneNumber(actorDisplayName),
        type: CONST.ICON_TYPE_AVATAR,
        fallbackIcon: actorDetails?.fallbackIcon,
    };

    if (isWorkspaceThread(report)) {
        const workspaceIcon = getWorkspaceIcon(report, policy);
        return [actorIcon, workspaceIcon];
    }
    return [actorIcon];
}

/**
 * Helper function to get the icons for a task report. Only to be used in getIcons().
 */
function getIconsForTaskReport(report: OnyxInputOrEntry<Report>, personalDetails: OnyxInputOrEntry<PersonalDetailsList>, policy: OnyxInputOrEntry<Policy>): Icon[] {
    const ownerIcon = getParticipantIcon(report?.ownerAccountID, personalDetails, true);
    if (report && isWorkspaceTaskReport(report)) {
        const workspaceIcon = getWorkspaceIcon(report, policy);
        return [ownerIcon, workspaceIcon];
    }
    return [ownerIcon];
}

/**
 * Helper function to get the icons for a domain room. Only to be used in getIcons().
 */
function getIconsForDomainRoom(report: OnyxInputOrEntry<Report>): Icon[] {
    const domainName = report?.reportName?.substring(1);
    const policyExpenseChatAvatarSource = getDefaultWorkspaceAvatar(domainName);
    const domainIcon: Icon = {
        source: policyExpenseChatAvatarSource,
        type: CONST.ICON_TYPE_WORKSPACE,
        name: domainName ?? '',
        id: report?.policyID,
    };
    return [domainIcon];
}

/**
 * Helper function to get the icons for a policy room. Only to be used in getIcons().
 */
function getIconsForPolicyRoom(
    report: OnyxInputOrEntry<Report>,
    personalDetails: OnyxInputOrEntry<PersonalDetailsList>,
    policy: OnyxInputOrEntry<Policy>,
    invoiceReceiverPolicy: OnyxInputOrEntry<Policy>,
): Icon[] {
    if (!report) {
        return [];
    }
    const icons = [getWorkspaceIcon(report, policy)];
    if (report && isInvoiceRoom(report)) {
        icons.push(...getInvoiceReceiverIcons(report, personalDetails, invoiceReceiverPolicy));
    }
    return icons;
}

/**
 * Helper function to get the icons for a policy expense chat. Only to be used in getIcons().
 */
function getIconsForPolicyExpenseChat(report: OnyxInputOrEntry<Report>, personalDetails: OnyxInputOrEntry<PersonalDetailsList>, policy: OnyxInputOrEntry<Policy>): Icon[] {
    if (!report) {
        return [];
    }
    const workspaceIcon = getWorkspaceIcon(report, policy);
    const memberIcon = getParticipantIcon(report?.ownerAccountID, personalDetails, true);
    return [workspaceIcon, memberIcon];
}

/**
 * Helper function to get the icons for an expense report. Only to be used in getIcons().
 */
function getIconsForExpenseReport(report: OnyxInputOrEntry<Report>, personalDetails: OnyxInputOrEntry<PersonalDetailsList>, policy: OnyxInputOrEntry<Policy>): Icon[] {
    if (!report) {
        return [];
    }
    const workspaceIcon = getWorkspaceIcon(report, policy);
    const memberIcon = getParticipantIcon(report?.ownerAccountID, personalDetails, true);
    return [memberIcon, workspaceIcon];
}

/**
 * Helper function to get the icons for an iou report. Only to be used in getIcons().
 */
function getIconsForIOUReport(report: OnyxInputOrEntry<Report>, personalDetails: OnyxInputOrEntry<PersonalDetailsList>): Icon[] {
    if (!report) {
        return [];
    }

    const managerDetails = report?.managerID ? personalDetails?.[report.managerID] : undefined;
    const ownerDetails = report?.ownerAccountID ? personalDetails?.[report.ownerAccountID] : undefined;
    const managerIcon = {
        source: managerDetails?.avatar ?? FallbackAvatar,
        id: report?.managerID,
        type: CONST.ICON_TYPE_AVATAR,
        name: managerDetails?.displayName ?? '',
        fallbackIcon: managerDetails?.fallbackIcon,
    };
    const ownerIcon = {
        id: report?.ownerAccountID,
        source: ownerDetails?.avatar ?? FallbackAvatar,
        type: CONST.ICON_TYPE_AVATAR,
        name: ownerDetails?.displayName ?? '',
        fallbackIcon: ownerDetails?.fallbackIcon,
    };
    const isManager = currentUserAccountID === report?.managerID;

    // For one transaction IOUs, display a simplified report icon
    if (isOneTransactionReport(report)) {
        return [ownerIcon];
    }

    return isManager ? [managerIcon, ownerIcon] : [ownerIcon, managerIcon];
}

/**
 * Helper function to get the icons for a group chat. Only to be used in getIcons().
 */
function getIconsForGroupChat(report: OnyxInputOrEntry<Report>): Icon[] {
    if (!report) {
        return [];
    }
    const groupChatIcon = {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        source: report.avatarUrl || getDefaultGroupAvatar(report.reportID),
        id: -1,
        type: CONST.ICON_TYPE_AVATAR,
        name: getGroupChatName(undefined, true, report),
    };
    return [groupChatIcon];
}

/**
 * Helper function to get the icons for an invoice report. Only to be used in getIcons().
 */
function getIconsForInvoiceReport(
    report: OnyxInputOrEntry<Report>,
    personalDetails: OnyxInputOrEntry<PersonalDetailsList>,
    policy: OnyxInputOrEntry<Policy>,
    invoiceReceiverPolicy: OnyxInputOrEntry<Policy>,
): Icon[] {
    if (!report) {
        return [];
    }
    const invoiceRoomReport = getReportOrDraftReport(report.chatReportID);
    const icons = [getWorkspaceIcon(invoiceRoomReport, policy)];

    if (invoiceRoomReport?.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL) {
        icons.push(...getIconsForParticipants([invoiceRoomReport?.invoiceReceiver.accountID], personalDetails));
        return icons;
    }

    const receiverPolicyID = invoiceRoomReport?.invoiceReceiver?.policyID;
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const receiverPolicy = invoiceReceiverPolicy ?? getPolicy(receiverPolicyID);

    if (!isEmptyObject(receiverPolicy)) {
        icons.push({
            source: receiverPolicy?.avatarURL ?? getDefaultWorkspaceAvatar(receiverPolicy.name),
            type: CONST.ICON_TYPE_WORKSPACE,
            name: receiverPolicy.name,
            id: receiverPolicyID,
        });
    }

    return icons;
}

/**
 * Returns the appropriate icons for the given chat report using the stored personalDetails.
 * The Avatar sources can be URLs or Icon components according to the chat type.
 */
function getIcons(
    report: OnyxInputOrEntry<Report>,
    personalDetails: OnyxInputOrEntry<PersonalDetailsList> = allPersonalDetails,
    defaultIcon: AvatarSource | null = null,
    defaultName = '',
    defaultAccountID = -1,
    policy?: OnyxInputOrEntry<Policy>,
    invoiceReceiverPolicy?: OnyxInputOrEntry<Policy>,
): Icon[] {
    if (isEmptyObject(report)) {
        return [
            {
                source: defaultIcon ?? FallbackAvatar,
                type: CONST.ICON_TYPE_AVATAR,
                name: defaultName,
                id: defaultAccountID,
            },
        ];
    }
    if (isExpenseRequest(report)) {
        return getIconsForExpenseRequest(report, personalDetails, policy);
    }
    if (isChatThread(report)) {
        return getIconsForChatThread(report, personalDetails, policy);
    }
    if (isTaskReport(report)) {
        return getIconsForTaskReport(report, personalDetails, policy);
    }
    if (isDomainRoom(report)) {
        return getIconsForDomainRoom(report);
    }
    const reportNameValuePairs = allReportNameValuePair?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report.reportID}`];
    // This will get removed as part of https://github.com/Expensify/App/issues/59961
    // eslint-disable-next-line deprecation/deprecation
    if (
        isAdminRoom(report) ||
        isAnnounceRoom(report) ||
        isChatRoom(report) ||
        (isArchivedNonExpenseReport(report, !!reportNameValuePairs?.private_isArchived) && !chatIncludesConcierge(report))
    ) {
        return getIconsForPolicyRoom(report, personalDetails, policy, invoiceReceiverPolicy);
    }
    if (isPolicyExpenseChat(report)) {
        return getIconsForPolicyExpenseChat(report, personalDetails, policy);
    }
    if (isExpenseReport(report)) {
        return getIconsForExpenseReport(report, personalDetails, policy);
    }
    if (isIOUReport(report)) {
        return getIconsForIOUReport(report, personalDetails);
    }
    if (isSelfDM(report)) {
        return getIconsForParticipants(currentUserAccountID ? [currentUserAccountID] : [], personalDetails);
    }
    if (isSystemChat(report)) {
        return getIconsForParticipants([CONST.ACCOUNT_ID.NOTIFICATIONS ?? 0], personalDetails);
    }
    if (isGroupChat(report)) {
        return getIconsForGroupChat(report);
    }
    if (isInvoiceReport(report)) {
        return getIconsForInvoiceReport(report, personalDetails, policy, invoiceReceiverPolicy);
    }
    if (isOneOnOneChat(report)) {
        const otherParticipantsAccountIDs = Object.keys(report.participants ?? {})
            .map(Number)
            .filter((accountID) => accountID !== currentUserAccountID);
        return getIconsForParticipants(otherParticipantsAccountIDs, personalDetails);
    }
    const participantAccountIDs = Object.keys(report.participants ?? {}).map(Number);
    return getIconsForParticipants(participantAccountIDs, personalDetails);
}

function getDisplayNamesWithTooltips(
    personalDetailsList: PersonalDetails[] | PersonalDetailsList | OptionData[],
    shouldUseShortForm: boolean,
    shouldFallbackToHidden = true,
    shouldAddCurrentUserPostfix = false,
): DisplayNameWithTooltips {
    const personalDetailsListArray = Array.isArray(personalDetailsList) ? personalDetailsList : Object.values(personalDetailsList);

    return personalDetailsListArray
        .map((user) => {
            const accountID = Number(user?.accountID);
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            const displayName = getDisplayNameForParticipant({accountID, shouldUseShortForm, shouldFallbackToHidden, shouldAddCurrentUserPostfix}) || user?.login || '';
            const avatar = user && 'avatar' in user ? user.avatar : undefined;

            let pronouns = user?.pronouns ?? undefined;
            if (pronouns?.startsWith(CONST.PRONOUNS.PREFIX)) {
                const pronounTranslationKey = pronouns.replace(CONST.PRONOUNS.PREFIX, '');
                pronouns = translateLocal(`pronouns.${pronounTranslationKey}` as TranslationPaths);
            }

            return {
                displayName,
                avatar,
                login: user?.login ?? '',
                accountID,
                pronouns,
            };
        })
        .sort((first, second) => {
            // First sort by displayName/login
            const displayNameLoginOrder = localeCompare(first.displayName, second.displayName);
            if (displayNameLoginOrder !== 0) {
                return displayNameLoginOrder;
            }

            // Then fallback on accountID as the final sorting criteria.
            return first.accountID - second.accountID;
        });
}

/**
 * Returns the the display names of the given user accountIDs
 */
function getUserDetailTooltipText(accountID: number, fallbackUserDisplayName = ''): string {
    const displayNameForParticipant = getDisplayNameForParticipant({accountID});
    return displayNameForParticipant || fallbackUserDisplayName;
}

/**
 * For a deleted parent report action within a chat report,
 * let us return the appropriate display message
 *
 * @param reportAction - The deleted report action of a chat report for which we need to return message.
 */
function getDeletedParentActionMessageForChatReport(reportAction: OnyxEntry<ReportAction>): string {
    // By default, let us display [Deleted message]
    let deletedMessageText = translateLocal('parentReportAction.deletedMessage');
    if (isCreatedTaskReportAction(reportAction)) {
        // For canceled task report, let us display [Deleted task]
        deletedMessageText = translateLocal('parentReportAction.deletedTask');
    }
    return deletedMessageText;
}

/**
 * Returns the preview message for `REIMBURSEMENT_QUEUED` action
 */
function getReimbursementQueuedActionMessage({
    reportAction,
    reportOrID,
    shouldUseShortDisplayName = true,
    reports,
    personalDetails,
}: {
    reportAction: OnyxEntry<ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_QUEUED>>;
    reportOrID: OnyxEntry<Report> | string | SearchReport;
    shouldUseShortDisplayName?: boolean;
    reports?: SearchReport[];
    personalDetails?: Partial<PersonalDetailsList>;
}): string {
    const report = typeof reportOrID === 'string' ? getReport(reportOrID, reports ?? allReports) : reportOrID;
    const submitterDisplayName = getDisplayNameForParticipant({accountID: report?.ownerAccountID, shouldUseShortForm: shouldUseShortDisplayName, personalDetailsData: personalDetails}) ?? '';
    const originalMessage = getOriginalMessage(reportAction);
    let messageKey: TranslationPaths;
    if (originalMessage?.paymentType === CONST.IOU.PAYMENT_TYPE.EXPENSIFY) {
        messageKey = 'iou.waitingOnEnabledWallet';
    } else {
        messageKey = 'iou.waitingOnBankAccount';
    }

    return translateLocal(messageKey, {submitterDisplayName});
}

/**
 * Returns the preview message for `REIMBURSEMENT_DEQUEUED` or `REIMBURSEMENT_ACH_CANCELED` action
 */
function getReimbursementDeQueuedOrCanceledActionMessage(
    reportAction: OnyxEntry<ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_DEQUEUED | typeof CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_ACH_CANCELED>>,
    reportOrID: OnyxEntry<Report> | string | SearchReport,
    isLHNPreview = false,
): string {
    const report = typeof reportOrID === 'string' ? getReport(reportOrID, allReports) : reportOrID;
    const originalMessage = getOriginalMessage(reportAction);
    const amount = originalMessage?.amount;
    const currency = originalMessage?.currency;
    const formattedAmount = convertToDisplayString(amount, currency);
    if (originalMessage?.cancellationReason === CONST.REPORT.CANCEL_PAYMENT_REASONS.ADMIN || originalMessage?.cancellationReason === CONST.REPORT.CANCEL_PAYMENT_REASONS.USER) {
        const payerOrApproverName = report?.managerID === currentUserAccountID || !isLHNPreview ? '' : getDisplayNameForParticipant({accountID: report?.managerID, shouldUseShortForm: true});
        return translateLocal('iou.adminCanceledRequest', {manager: payerOrApproverName, amount: formattedAmount});
    }
    const submitterDisplayName = getDisplayNameForParticipant({accountID: report?.ownerAccountID, shouldUseShortForm: true}) ?? '';
    return translateLocal('iou.canceledRequest', {submitterDisplayName, amount: formattedAmount});
}

/**
 * Builds an optimistic REIMBURSEMENT_DEQUEUED report action with a randomly generated reportActionID.
 *
 */
function buildOptimisticChangeFieldAction(reportField: PolicyReportField, previousReportField: PolicyReportField): OptimisticChangeFieldAction {
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.CHANGE_FIELD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: 'TEXT',
                style: 'strong',
                text: 'You',
            },
            {
                type: 'TEXT',
                style: 'normal',
                text: ` modified field '${reportField.name}'.`,
            },
            {
                type: 'TEXT',
                style: 'normal',
                text: ` New value is '${reportField.value}'`,
            },
            {
                type: 'TEXT',
                style: 'normal',
                text: ` (previously '${previousReportField.value}').`,
            },
        ],
        originalMessage: {
            fieldName: reportField.name,
            newType: reportField.type,
            newValue: reportField.value,
            oldType: previousReportField.type,
            oldValue: previousReportField.value,
        },
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: rand64(),
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Builds an optimistic REIMBURSEMENT_DEQUEUED report action with a randomly generated reportActionID.
 *
 */
function buildOptimisticCancelPaymentReportAction(expenseReportID: string, amount: number, currency: string): OptimisticCancelPaymentReportAction {
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_DEQUEUED,
        actorAccountID: currentUserAccountID,
        message: [
            {
                cancellationReason: CONST.REPORT.CANCEL_PAYMENT_REASONS.ADMIN,
                expenseReportID,
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                text: '',
                amount,
                currency,
            },
        ],
        originalMessage: {
            cancellationReason: CONST.REPORT.CANCEL_PAYMENT_REASONS.ADMIN,
            expenseReportID,
            amount,
            currency,
        },
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Returns the last visible message for a given report after considering the given optimistic actions
 *
 * @param reportID - the report for which last visible message has to be fetched
 * @param [actionsToMerge] - the optimistic merge actions that needs to be considered while fetching last visible message

 */
function getLastVisibleMessage(reportID: string | undefined, actionsToMerge: ReportActions = {}): LastVisibleMessage {
    const report = getReportOrDraftReport(reportID);
    const lastVisibleAction = getLastVisibleActionReportActionsUtils(reportID, canUserPerformWriteAction(report), actionsToMerge);

    // For Chat Report with deleted parent actions, let us fetch the correct message
    if (isDeletedParentAction(lastVisibleAction) && !isEmptyObject(report) && isChatReport(report)) {
        const lastMessageText = getDeletedParentActionMessageForChatReport(lastVisibleAction);
        return {
            lastMessageText,
        };
    }

    // Fetch the last visible message for report represented by reportID and based on actions to merge.
    return getLastVisibleMessageReportActionsUtils(reportID, canUserPerformWriteAction(report), actionsToMerge);
}

/**
 * Checks if a report is waiting for the manager to complete an action.
 * Example: the assignee of an open task report or the manager of a processing expense report.
 *
 * @param [parentReportAction] - The parent report action of the report (Used to check if the task has been canceled)
 */
function isWaitingForAssigneeToCompleteAction(report: OnyxEntry<Report>, parentReportAction: OnyxEntry<ReportAction>): boolean {
    if (report?.hasOutstandingChildTask) {
        return true;
    }

    if (report?.hasParentAccess === false && isReportManager(report)) {
        if (isOpenTaskReport(report, parentReportAction)) {
            return true;
        }

        if (isProcessingReport(report) && isExpenseReport(report)) {
            return true;
        }
    }

    return false;
}

function isUnreadWithMention(reportOrOption: OnyxEntry<Report> | OptionData): boolean {
    if (!reportOrOption) {
        return false;
    }
    // lastMentionedTime and lastReadTime are both datetime strings and can be compared directly
    const lastMentionedTime = reportOrOption.lastMentionedTime ?? '';
    const lastReadTime = reportOrOption.lastReadTime ?? '';
    return !!('isUnreadWithMention' in reportOrOption && reportOrOption.isUnreadWithMention) || lastReadTime < lastMentionedTime;
}

type ReasonAndReportActionThatRequiresAttention = {
    reason: ValueOf<typeof CONST.REQUIRES_ATTENTION_REASONS>;
    reportAction?: OnyxEntry<ReportAction>;
};

function getReasonAndReportActionThatRequiresAttention(
    optionOrReport: OnyxEntry<Report> | OptionData,
    parentReportAction?: OnyxEntry<ReportAction>,
    isReportArchived = false,
): ReasonAndReportActionThatRequiresAttention | null {
    if (!optionOrReport) {
        return null;
    }

    const reportActions = getAllReportActions(optionOrReport.reportID);

    if (isJoinRequestInAdminRoom(optionOrReport)) {
        return {
            reason: CONST.REQUIRES_ATTENTION_REASONS.HAS_JOIN_REQUEST,
            reportAction: getActionableJoinRequestPendingReportAction(optionOrReport.reportID),
        };
    }

    if (isReportArchived) {
        return null;
    }

    if (isUnreadWithMention(optionOrReport)) {
        return {
            reason: CONST.REQUIRES_ATTENTION_REASONS.IS_UNREAD_WITH_MENTION,
        };
    }

    if (isWaitingForAssigneeToCompleteAction(optionOrReport, parentReportAction)) {
        return {
            reason: CONST.REQUIRES_ATTENTION_REASONS.IS_WAITING_FOR_ASSIGNEE_TO_COMPLETE_ACTION,
            reportAction: Object.values(reportActions).find((action) => action.childType === CONST.REPORT.TYPE.TASK),
        };
    }

    const iouReportActionToApproveOrPay = getIOUReportActionToApproveOrPay(optionOrReport, undefined);
    const iouReportID = getIOUReportIDFromReportActionPreview(iouReportActionToApproveOrPay);
    const transactions = getReportTransactions(iouReportID);
    const hasOnlyPendingTransactions = transactions.length > 0 && transactions.every((t) => isExpensifyCardTransaction(t) && isPending(t));

    // Has a child report that is awaiting action (e.g. approve, pay, add bank account) from current user
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(optionOrReport.policyID);
    if (
        (optionOrReport.hasOutstandingChildRequest === true || iouReportActionToApproveOrPay?.reportActionID) &&
        (policy?.reimbursementChoice !== CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_NO || !hasOnlyPendingTransactions)
    ) {
        return {
            reason: CONST.REQUIRES_ATTENTION_REASONS.HAS_CHILD_REPORT_AWAITING_ACTION,
            reportAction: iouReportActionToApproveOrPay,
        };
    }

    if (hasMissingInvoiceBankAccount(optionOrReport.reportID) && !isSettled(optionOrReport.reportID)) {
        return {
            reason: CONST.REQUIRES_ATTENTION_REASONS.HAS_MISSING_INVOICE_BANK_ACCOUNT,
        };
    }

    if (isInvoiceRoom(optionOrReport)) {
        const reportAction = Object.values(reportActions).find(
            (action) =>
                action.actionName === CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW &&
                action.childReportID &&
                hasMissingInvoiceBankAccount(action.childReportID) &&
                !isSettled(action.childReportID),
        );

        return reportAction
            ? {
                  reason: CONST.REQUIRES_ATTENTION_REASONS.HAS_MISSING_INVOICE_BANK_ACCOUNT,
                  reportAction,
              }
            : null;
    }

    return null;
}

/**
 * Determines if the option requires action from the current user. This can happen when it:
 *  - is unread and the user was mentioned in one of the unread comments
 *  - is for an outstanding task waiting on the user
 *  - has an outstanding child expense that is waiting for an action from the current user (e.g. pay, approve, add bank account)
 *  - is either the system or concierge chat, the user free trial has ended and it didn't add a payment card yet
 *
 * @param option (report or optionItem)
 * @param parentReportAction (the report action the current report is a thread of)
 */
function requiresAttentionFromCurrentUser(optionOrReport: OnyxEntry<Report> | OptionData, parentReportAction?: OnyxEntry<ReportAction>, isReportArchived = false) {
    return !!getReasonAndReportActionThatRequiresAttention(optionOrReport, parentReportAction, isReportArchived);
}

/**
 * Checks if the report contains at least one Non-Reimbursable transaction
 */
function hasNonReimbursableTransactions(iouReportID: string | undefined, reportsTransactionsParam: Record<string, Transaction[]> = reportsTransactions): boolean {
    const transactions = getReportTransactions(iouReportID, reportsTransactionsParam);
    return transactions.filter((transaction) => transaction.reimbursable === false).length > 0;
}

function getMoneyRequestSpendBreakdown(report: OnyxInputOrEntry<Report>, searchReports?: SearchReport[]): SpendBreakdown {
    const reports = searchReports ?? allReports;
    let moneyRequestReport: OnyxEntry<Report>;
    if (report && (isMoneyRequestReport(report, searchReports) || isInvoiceReport(report))) {
        moneyRequestReport = report;
    }
    if (reports && report?.iouReportID) {
        moneyRequestReport = getReport(report.iouReportID, allReports);
    }
    if (moneyRequestReport) {
        let nonReimbursableSpend = moneyRequestReport.nonReimbursableTotal ?? 0;
        let totalSpend = moneyRequestReport.total ?? 0;

        if (nonReimbursableSpend + totalSpend !== 0) {
            // There is a possibility that if the Expense report has a negative total.
            // This is because there are instances where you can get a credit back on your card,
            // or you enter a negative expense to "offset" future expenses
            nonReimbursableSpend = isExpenseReport(moneyRequestReport) ? nonReimbursableSpend * -1 : Math.abs(nonReimbursableSpend);
            totalSpend = isExpenseReport(moneyRequestReport) ? totalSpend * -1 : Math.abs(totalSpend);

            const totalDisplaySpend = totalSpend;
            const reimbursableSpend = totalDisplaySpend - nonReimbursableSpend;

            return {
                nonReimbursableSpend,
                reimbursableSpend,
                totalDisplaySpend,
            };
        }
    }
    return {
        nonReimbursableSpend: 0,
        reimbursableSpend: 0,
        totalDisplaySpend: 0,
    };
}

/**
 * Get the title for a policy expense chat which depends on the role of the policy member seeing this report
 */
function getPolicyExpenseChatName({
    report,
    policy,
    personalDetailsList = allPersonalDetails,
    policies,
    reports,
}: {
    report: OnyxEntry<Report>;
    policy?: OnyxEntry<Policy> | SearchPolicy;
    personalDetailsList?: Partial<PersonalDetailsList>;
    policies?: SearchPolicy[];
    reports?: SearchReport[];
}): string | undefined {
    const ownerAccountID = report?.ownerAccountID;
    const personalDetails = ownerAccountID ? personalDetailsList?.[ownerAccountID] : undefined;
    const login = personalDetails ? personalDetails.login : null;
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const reportOwnerDisplayName = getDisplayNameForParticipant({accountID: ownerAccountID, shouldRemoveDomain: true}) || login;

    if (reportOwnerDisplayName) {
        return translateLocal('workspace.common.policyExpenseChatName', {displayName: reportOwnerDisplayName});
    }

    let policyExpenseChatRole = 'user';

    const policyItem = policies ? policies.find((p) => p.id === report?.policyID) : allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];
    if (policyItem) {
        policyExpenseChatRole = policyItem.role || 'user';
    }

    // If this user is not admin and this policy expense chat has been archived because of account merging, this must be an old expense chat
    // of the account which was merged into the current user's account. Use the name of the policy as the name of the report.
    // This will get removed as part of https://github.com/Expensify/App/issues/59961
    // eslint-disable-next-line deprecation/deprecation
    if (isArchivedNonExpenseReport(report, !!getReportNameValuePairs(report?.reportID)?.private_isArchived)) {
        const lastAction = getLastVisibleActionReportActionsUtils(report?.reportID);
        const archiveReason = isClosedAction(lastAction) ? getOriginalMessage(lastAction)?.reason : CONST.REPORT.ARCHIVE_REASON.DEFAULT;
        if (archiveReason === CONST.REPORT.ARCHIVE_REASON.ACCOUNT_MERGED && policyExpenseChatRole !== CONST.POLICY.ROLE.ADMIN) {
            return getPolicyName({report, policy, policies, reports});
        }
    }
    return report?.reportName;
}

function getArchiveReason(reportActions: OnyxEntry<ReportActions>): ValueOf<typeof CONST.REPORT.ARCHIVE_REASON> | undefined {
    const lastClosedReportAction = getLastClosedReportAction(reportActions);

    if (!lastClosedReportAction) {
        return undefined;
    }

    return isClosedAction(lastClosedReportAction) ? getOriginalMessage(lastClosedReportAction)?.reason : CONST.REPORT.ARCHIVE_REASON.DEFAULT;
}

/**
 * Given a report field, check if the field is for the report title.
 */
function isReportFieldOfTypeTitle(reportField: OnyxEntry<PolicyReportField>): boolean {
    return reportField?.fieldID === CONST.REPORT_FIELD_TITLE_FIELD_ID;
}

/**
 * Check if Report has any held expenses
 */
function isHoldCreator(transaction: OnyxEntry<Transaction>, reportID: string | undefined): boolean {
    const holdReportAction = getReportAction(reportID, `${transaction?.comment?.hold ?? ''}`);
    return isActionCreator(holdReportAction);
}

/**
 * Given a report field, check if the field can be edited or not.
 * For title fields, its considered disabled if `deletable` prop is `true` (https://github.com/Expensify/App/issues/35043#issuecomment-1911275433)
 * For non title fields, its considered disabled if:
 * 1. The user is not admin of the report
 * 2. Report is settled or it is closed
 */
function isReportFieldDisabled(report: OnyxEntry<Report>, reportField: OnyxEntry<PolicyReportField>, policy: OnyxEntry<Policy>): boolean {
    if (isInvoiceReport(report)) {
        return true;
    }
    const isReportSettled = isSettled(report?.reportID);
    const isReportClosed = isClosedReport(report);
    const isTitleField = isReportFieldOfTypeTitle(reportField);
    const isAdmin = isPolicyAdmin(report?.policyID, {[`${ONYXKEYS.COLLECTION.POLICY}${policy?.id}`]: policy});
    const isApproved = isReportApproved({report});
    if (!isAdmin && (isReportSettled || isReportClosed || isApproved)) {
        return true;
    }

    if (isTitleField) {
        return !reportField?.deletable;
    }

    return false;
}

/**
 * Given a set of report fields, return the field that refers to title
 */
function getTitleReportField(reportFields: Record<string, PolicyReportField>) {
    return Object.values(reportFields).find((field) => isReportFieldOfTypeTitle(field));
}

/**
 * Get the key for a report field
 */
function getReportFieldKey(reportFieldId: string | undefined) {
    if (!reportFieldId) {
        return '';
    }

    // We don't need to add `expensify_` prefix to the title field key, because backend stored title under a unique key `text_title`,
    // and all the other report field keys are stored under `expensify_FIELD_ID`.
    if (reportFieldId === CONST.REPORT_FIELD_TITLE_FIELD_ID) {
        return reportFieldId;
    }

    return `expensify_${reportFieldId}`;
}

/**
 * Get the report fields attached to the policy given policyID
 */
function getReportFieldsByPolicyID(policyID: string | undefined): Record<string, PolicyReportField> {
    if (!policyID) {
        return {};
    }

    const policyReportFields = Object.entries(allPolicies ?? {}).find(([key]) => key.replace(ONYXKEYS.COLLECTION.POLICY, '') === policyID);
    const fieldList = policyReportFields?.[1]?.fieldList;

    if (!policyReportFields || !fieldList) {
        return {};
    }

    return fieldList;
}

/**
 * Get the report fields that we should display a MoneyReportView gets opened
 */

function getAvailableReportFields(report: OnyxEntry<Report>, policyReportFields: PolicyReportField[]): PolicyReportField[] {
    // Get the report fields that are attached to a report. These will persist even if a field is deleted from the policy.
    const reportFields = Object.values(report?.fieldList ?? {});
    const reportIsSettled = isSettled(report?.reportID);

    // If the report is settled, we don't want to show any new field that gets added to the policy.
    if (reportIsSettled) {
        return reportFields;
    }

    // If the report is unsettled, we want to merge the new fields that get added to the policy with the fields that
    // are attached to the report.
    const mergedFieldIds = Array.from(new Set([...policyReportFields.map(({fieldID}) => fieldID), ...reportFields.map(({fieldID}) => fieldID)]));

    const fields = mergedFieldIds.map((id) => {
        const field = report?.fieldList?.[getReportFieldKey(id)];

        if (field) {
            return field;
        }

        const policyReportField = policyReportFields.find(({fieldID}) => fieldID === id);

        if (policyReportField) {
            return policyReportField;
        }

        return null;
    });

    return fields.filter(Boolean) as PolicyReportField[];
}

/**
 * Get the title for an IOU or expense chat which will be showing the payer and the amount
 */
function getMoneyRequestReportName({
    report,
    policy,
    invoiceReceiverPolicy,
}: {
    report: OnyxEntry<Report>;
    policy?: OnyxEntry<Policy> | SearchPolicy;
    invoiceReceiverPolicy?: OnyxEntry<Policy> | SearchPolicy;
}): string {
    if (report?.reportName && isExpenseReport(report)) {
        return report.reportName;
    }

    const moneyRequestTotal = getMoneyRequestSpendBreakdown(report).totalDisplaySpend;
    const formattedAmount = convertToDisplayString(moneyRequestTotal, report?.currency);

    let payerOrApproverName;
    if (isExpenseReport(report)) {
        const parentReport = getParentReport(report);
        payerOrApproverName = getPolicyName({report: parentReport ?? report, policy});
    } else if (isInvoiceReport(report)) {
        const chatReport = getReportOrDraftReport(report?.chatReportID);
        payerOrApproverName = getInvoicePayerName(chatReport, invoiceReceiverPolicy);
    } else {
        payerOrApproverName = getDisplayNameForParticipant({accountID: report?.managerID}) ?? '';
    }

    const payerPaidAmountMessage = translateLocal('iou.payerPaidAmount', {
        payer: payerOrApproverName,
        amount: formattedAmount,
    });

    if (isReportApproved({report})) {
        return translateLocal('iou.managerApprovedAmount', {
            manager: payerOrApproverName,
            amount: formattedAmount,
        });
    }

    if (report?.isWaitingOnBankAccount) {
        return `${payerPaidAmountMessage} ${CONST.DOT_SEPARATOR} ${translateLocal('iou.pending')}`;
    }

    if (!isSettled(report?.reportID) && hasNonReimbursableTransactions(report?.reportID)) {
        payerOrApproverName = getDisplayNameForParticipant({accountID: report?.ownerAccountID}) ?? '';
        return translateLocal('iou.payerSpentAmount', {payer: payerOrApproverName, amount: formattedAmount});
    }

    if (isProcessingReport(report) || isOpenExpenseReport(report) || isOpenInvoiceReport(report) || moneyRequestTotal === 0) {
        return translateLocal('iou.payerOwesAmount', {payer: payerOrApproverName, amount: formattedAmount});
    }

    return payerPaidAmountMessage;
}

/**
 * Gets transaction created, amount, currency, comment, and waypoints (for distance expense)
 * into a flat object. Used for displaying transactions and sending them in API commands
 */

function getTransactionDetails(
    transaction: OnyxInputOrEntry<Transaction>,
    createdDateFormat: string = CONST.DATE.FNS_FORMAT_STRING,
    policy: OnyxEntry<Policy> = undefined,
): TransactionDetails | undefined {
    if (!transaction) {
        return;
    }
    const report = getReportOrDraftReport(transaction?.reportID);
    return {
        created: getFormattedCreated(transaction, createdDateFormat),
        amount: getTransactionAmount(transaction, !isEmptyObject(report) && isExpenseReport(report), transaction?.reportID === CONST.REPORT.UNREPORTED_REPORT_ID),
        attendees: getAttendees(transaction),
        taxAmount: getTaxAmount(transaction, !isEmptyObject(report) && isExpenseReport(report)),
        taxCode: getTaxCode(transaction),
        currency: getCurrency(transaction),
        comment: getDescription(transaction),
        merchant: getMerchant(transaction, policy),
        waypoints: getWaypoints(transaction),
        customUnitRateID: getRateID(transaction),
        category: getCategory(transaction),
        billable: getBillable(transaction),
        tag: getTag(transaction),
        mccGroup: getMCCGroup(transaction),
        cardID: getCardID(transaction),
        cardName: getCardName(transaction),
        originalAmount: getOriginalAmount(transaction),
        originalCurrency: getOriginalCurrency(transaction),
        postedDate: getFormattedPostedDate(transaction),
    };
}

function getTransactionCommentObject(transaction: OnyxEntry<Transaction>): Comment {
    return {
        ...transaction?.comment,
        comment: Parser.htmlToMarkdown(transaction?.comment?.comment ?? ''),
        waypoints: getWaypoints(transaction),
    };
}

function isWorkspacePayer(memberLogin: string, policy: OnyxEntry<Policy>): boolean {
    const isAdmin = policy?.employeeList?.[memberLogin]?.role === CONST.POLICY.ROLE.ADMIN;
    if (isPaidGroupPolicyPolicyUtils(policy)) {
        if (policy?.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_YES) {
            // If we get here without a reimburser only admin is the payer.
            if (!policy?.achAccount?.reimburser) {
                return isAdmin;
            }

            // If we are the reimburser then we are the payer.
            const isReimburser = memberLogin === policy?.achAccount?.reimburser;
            return isReimburser;
        }
        if (policy?.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_MANUAL) {
            return isAdmin;
        }
        return false;
    }
    return false;
}

/**
 * Can only edit if:
 *
 * - in case of IOU report
 *    - the current user is the requestor and is not settled yet
 * - in case of expense report
 *    - the current user is the requestor and is not settled yet
 *    - the current user is the manager of the report
 *    - or the current user is an admin on the policy the expense report is tied to
 *
 *    This is used in conjunction with canEditRestrictedField to control editing of specific fields like amount, currency, created, receipt, and distance.
 *    On its own, it only controls allowing/disallowing navigating to the editing pages or showing/hiding the 'Edit' icon on report actions
 */
function canEditMoneyRequest(
    reportAction: OnyxInputOrEntry<ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.IOU>>,
    linkedTransaction?: OnyxEntry<Transaction>,
    isChatReportArchived = false,
): boolean {
    const isDeleted = isDeletedAction(reportAction);

    if (isDeleted) {
        return false;
    }

    const allowedReportActionType: Array<ValueOf<typeof CONST.IOU.REPORT_ACTION_TYPE>> = [CONST.IOU.REPORT_ACTION_TYPE.TRACK, CONST.IOU.REPORT_ACTION_TYPE.CREATE];
    const originalMessage = getOriginalMessage(reportAction);
    const actionType = originalMessage?.type;

    if (!actionType || !allowedReportActionType.includes(actionType)) {
        return false;
    }

    const transaction = linkedTransaction ?? getLinkedTransaction(reportAction ?? undefined);

    // In case the transaction is failed to be created, we should disable editing the money request
    if (!transaction?.transactionID || (transaction?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD && !isEmptyObject(transaction.errors))) {
        return false;
    }

    const moneyRequestReportID = originalMessage?.IOUReportID;

    if (!moneyRequestReportID) {
        return actionType === CONST.IOU.REPORT_ACTION_TYPE.TRACK;
    }

    const moneyRequestReport = getReportOrDraftReport(String(moneyRequestReportID));
    const isRequestor = currentUserAccountID === reportAction?.actorAccountID;

    const isSubmitted = isProcessingReport(moneyRequestReport);
    if (isIOUReport(moneyRequestReport)) {
        return isSubmitted && isRequestor;
    }
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(moneyRequestReport?.policyID);
    const isAdmin = policy?.role === CONST.POLICY.ROLE.ADMIN;
    const isManager = currentUserAccountID === moneyRequestReport?.managerID;

    if (isInvoiceReport(moneyRequestReport) && (isManager || isChatReportArchived)) {
        return false;
    }

    // Admin & managers can always edit coding fields such as tag, category, billable, etc.
    if (isAdmin || isManager) {
        return true;
    }

    if (policy?.type === CONST.POLICY.TYPE.CORPORATE && moneyRequestReport && isSubmitted && isCurrentUserSubmitter(moneyRequestReport)) {
        const isForwarded = getSubmitToAccountID(policy, moneyRequestReport) !== moneyRequestReport.managerID;
        return !isForwarded;
    }

    return !isReportApproved({report: moneyRequestReport}) && !isSettled(moneyRequestReport?.reportID) && !isClosedReport(moneyRequestReport) && isRequestor;
}

function getNextApproverAccountID(report: OnyxEntry<Report>, isUnapproved = false) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(report?.policyID);
    const approvalChain = getApprovalChain(policy, report);
    const submitToAccountID = getSubmitToAccountID(policy, report);

    if (isUnapproved) {
        if (approvalChain.includes(currentUserEmail ?? '')) {
            return currentUserAccountID;
        }

        return report?.managerID;
    }

    if (approvalChain.length === 0) {
        return submitToAccountID;
    }

    const nextApproverEmail = approvalChain.length === 1 ? approvalChain.at(0) : approvalChain.at(approvalChain.indexOf(currentUserEmail ?? '') + 1);
    if (!nextApproverEmail) {
        return submitToAccountID;
    }

    return getAccountIDsByLogins([nextApproverEmail]).at(0);
}

function canEditReportPolicy(report: OnyxEntry<Report>, reportPolicy: OnyxEntry<Policy>): boolean {
    const isAdmin = isPolicyAdminPolicyUtils(reportPolicy);
    const isManager = isReportManager(report);
    const isSubmitter = isReportOwner(report);
    const isReportAuditor = isAuditor(report);
    const isIOUType = isIOUReport(report);
    const isInvoiceType = isInvoiceReport(report);
    const isExpenseType = isExpenseReport(report);
    const isOpen = isOpenReport(report);
    const isSubmitted = isProcessingReport(report);
    const isReimbursed = isReportManuallyReimbursed(report);

    if (isIOUType) {
        return isOpen || isSubmitted || isReimbursed;
    }

    if (isInvoiceType) {
        return isOpen && !isReportAuditor;
    }

    if (isExpenseType) {
        if (isOpen) {
            return isSubmitter || isAdmin;
        }

        if (isSubmitted) {
            return (isSubmitter && isAwaitingFirstLevelApproval(report)) || isManager || isAdmin;
        }

        return isManager || isAdmin;
    }

    return false;
}

/**
 * Checks if the current user can edit the provided property of an expense
 *
 */
function canEditFieldOfMoneyRequest(
    reportAction: OnyxInputOrEntry<ReportAction>,
    fieldToEdit: ValueOf<typeof CONST.EDIT_REQUEST_FIELD>,
    isDeleteAction?: boolean,
    isChatReportArchived = false,
): boolean {
    // A list of fields that cannot be edited by anyone, once an expense has been settled
    const restrictedFields: string[] = [
        CONST.EDIT_REQUEST_FIELD.AMOUNT,
        CONST.EDIT_REQUEST_FIELD.CURRENCY,
        CONST.EDIT_REQUEST_FIELD.MERCHANT,
        CONST.EDIT_REQUEST_FIELD.DATE,
        CONST.EDIT_REQUEST_FIELD.RECEIPT,
        CONST.EDIT_REQUEST_FIELD.DISTANCE,
        CONST.EDIT_REQUEST_FIELD.DISTANCE_RATE,
        CONST.EDIT_REQUEST_FIELD.REPORT,
    ];

    if (!isMoneyRequestAction(reportAction) || !canEditMoneyRequest(reportAction, undefined, isChatReportArchived)) {
        return false;
    }

    // If we're editing fields such as category, tag, description, etc. the check above should be enough for handling the permission
    if (!restrictedFields.includes(fieldToEdit)) {
        return true;
    }

    const iouMessage = getOriginalMessage(reportAction);
    const moneyRequestReport = iouMessage?.IOUReportID ? (getReport(iouMessage?.IOUReportID, allReports) ?? ({} as Report)) : ({} as Report);
    const transaction = allTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${iouMessage?.IOUTransactionID}`] ?? ({} as Transaction);

    if (isSettled(String(moneyRequestReport.reportID)) || isReportIDApproved(String(moneyRequestReport.reportID))) {
        return false;
    }

    if (
        (fieldToEdit === CONST.EDIT_REQUEST_FIELD.AMOUNT || fieldToEdit === CONST.EDIT_REQUEST_FIELD.CURRENCY || fieldToEdit === CONST.EDIT_REQUEST_FIELD.DATE) &&
        isCardTransactionTransactionUtils(transaction)
    ) {
        return false;
    }

    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(moneyRequestReport?.policyID);
    const isAdmin = isExpenseReport(moneyRequestReport) && policy?.role === CONST.POLICY.ROLE.ADMIN;
    const isManager = isExpenseReport(moneyRequestReport) && currentUserAccountID === moneyRequestReport?.managerID;

    if ((fieldToEdit === CONST.EDIT_REQUEST_FIELD.AMOUNT || fieldToEdit === CONST.EDIT_REQUEST_FIELD.CURRENCY) && isDistanceRequest(transaction)) {
        return isAdmin || isManager;
    }

    if (
        (fieldToEdit === CONST.EDIT_REQUEST_FIELD.AMOUNT || fieldToEdit === CONST.EDIT_REQUEST_FIELD.CURRENCY || fieldToEdit === CONST.EDIT_REQUEST_FIELD.MERCHANT) &&
        isPerDiemRequest(transaction)
    ) {
        return false;
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.RECEIPT) {
        const isRequestor = currentUserAccountID === reportAction?.actorAccountID;
        return (
            !isInvoiceReport(moneyRequestReport) &&
            !isReceiptBeingScanned(transaction) &&
            !isDistanceRequest(transaction) &&
            !isPerDiemRequest(transaction) &&
            (isAdmin || isManager || isRequestor) &&
            (isDeleteAction ? isRequestor : true)
        );
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.DISTANCE_RATE) {
        // The distance rate can be modified only on the distance expense reports
        return isExpenseReport(moneyRequestReport) && isDistanceRequest(transaction);
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.REPORT) {
        // Unreported transaction from OldDot can have the reportID as an empty string
        const isUnreportedExpense = !transaction?.reportID || transaction?.reportID === CONST.REPORT.UNREPORTED_REPORT_ID;

        if (isInvoiceReport(moneyRequestReport) && !isUnreportedExpense) {
            return (
                getOutstandingReportsForUser(
                    moneyRequestReport?.policyID,
                    moneyRequestReport?.ownerAccountID,
                    reportsByPolicyID?.[moneyRequestReport?.policyID ?? CONST.DEFAULT_NUMBER_ID] ?? {},
                ).length > 0
            );
        }

        return isUnreportedExpense
            ? Object.values(allPolicies ?? {}).flatMap((currentPolicy) =>
                  getOutstandingReportsForUser(currentPolicy?.id, currentUserAccountID, reportsByPolicyID?.[currentPolicy?.id ?? CONST.DEFAULT_NUMBER_ID] ?? {}),
              ).length > 0
            : Object.values(allPolicies ?? {}).flatMap((currentPolicy) =>
                  getOutstandingReportsForUser(currentPolicy?.id, moneyRequestReport?.ownerAccountID, reportsByPolicyID?.[currentPolicy?.id ?? CONST.DEFAULT_NUMBER_ID] ?? {}),
              ).length > 1;
    }

    return true;
}

/**
 * Can only edit if:
 *
 * - It was written by the current user
 * - It's an ADD_COMMENT that is not an attachment
 * - It's an expense where conditions for modifications are defined in canEditMoneyRequest method
 * - It's not pending deletion
 */
function canEditReportAction(reportAction: OnyxInputOrEntry<ReportAction>): boolean {
    const isCommentOrIOU = reportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT || reportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.IOU;
    const message = reportAction ? getReportActionMessageReportUtils(reportAction) : undefined;

    return !!(
        reportAction?.actorAccountID === currentUserAccountID &&
        isCommentOrIOU &&
        (!isMoneyRequestAction(reportAction) || canEditMoneyRequest(reportAction)) && // Returns true for non-IOU actions
        !isReportMessageAttachment(message) &&
        ((!reportAction.isAttachmentWithText && !reportAction.isAttachmentOnly) || !reportAction.isOptimisticAction) &&
        !isDeletedAction(reportAction) &&
        !isCreatedTaskReportAction(reportAction) &&
        reportAction?.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE
    );
}

/**
 * This function is needed due to the fact that when we first create an empty report, its preview action has an actorAccountID of '0'.
 * This is not the case when the report is automatically created by adding expenses to the chat where no open report is available.
 * Can be simplified by comparing actorAccountID to accountID when mentioned issue is no longer a thing on a BE side.
 */
function isActionOrReportPreviewOwner(report: Report) {
    const parentAction = getReportAction(report.parentReportID, report.parentReportActionID);
    const {accountID} = currentUserPersonalDetails ?? {};
    const {actorAccountID, actionName, childOwnerAccountID} = parentAction ?? {};
    if (typeof accountID === 'number' && typeof actorAccountID === 'number' && accountID === actorAccountID) {
        return true;
    }
    return actionName === CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW && childOwnerAccountID === accountID;
}

function canHoldUnholdReportAction(reportAction: OnyxInputOrEntry<ReportAction>): {canHoldRequest: boolean; canUnholdRequest: boolean} {
    if (!isMoneyRequestAction(reportAction)) {
        return {canHoldRequest: false, canUnholdRequest: false};
    }

    const moneyRequestReportID = getOriginalMessage(reportAction)?.IOUReportID;
    const moneyRequestReport = getReportOrDraftReport(String(moneyRequestReportID));

    if (!moneyRequestReportID || !moneyRequestReport) {
        return {canHoldRequest: false, canUnholdRequest: false};
    }

    if (isInvoiceReport(moneyRequestReport)) {
        return {
            canHoldRequest: false,
            canUnholdRequest: false,
        };
    }

    const isRequestSettled = isSettled(moneyRequestReport?.reportID);
    const isApproved = isReportApproved({report: moneyRequestReport});
    const transactionID = moneyRequestReport ? getOriginalMessage(reportAction)?.IOUTransactionID : undefined;
    const transaction = allTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`] ?? ({} as Transaction);

    const parentReportAction = isThread(moneyRequestReport)
        ? allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${moneyRequestReport.parentReportID}`]?.[moneyRequestReport.parentReportActionID]
        : undefined;

    const isRequestIOU = isIOUReport(moneyRequestReport);
    const isHoldActionCreator = isHoldCreator(transaction, reportAction.childReportID);

    const isTrackExpenseMoneyReport = isTrackExpenseReport(moneyRequestReport);
    const isActionOwner = isActionOrReportPreviewOwner(moneyRequestReport);
    const isApprover = isMoneyRequestReport(moneyRequestReport) && moneyRequestReport?.managerID !== null && currentUserPersonalDetails?.accountID === moneyRequestReport?.managerID;
    const isAdmin = isPolicyAdmin(moneyRequestReport.policyID, allPolicies);
    const isOnHold = isOnHoldTransactionUtils(transaction);
    const isClosed = isClosedReport(moneyRequestReport);

    const isSubmitted = isProcessingReport(moneyRequestReport);
    const canModifyStatus = !isTrackExpenseMoneyReport && (isAdmin || isActionOwner || isApprover);
    const canModifyUnholdStatus = !isTrackExpenseMoneyReport && (isAdmin || (isActionOwner && isHoldActionCreator) || isApprover);
    const isDeletedParentActionLocal = isEmptyObject(parentReportAction) || isDeletedAction(parentReportAction);

    const canHoldOrUnholdRequest = !isRequestSettled && !isApproved && !isDeletedParentActionLocal && !isClosed && !isDeletedParentAction(reportAction);
    const canHoldRequest = canHoldOrUnholdRequest && !isOnHold && (isRequestIOU || canModifyStatus) && !isScanning(transaction) && (isSubmitted || isActionOwner);
    const canUnholdRequest = !!(canHoldOrUnholdRequest && isOnHold && (isRequestIOU ? isHoldActionCreator : canModifyUnholdStatus));

    return {canHoldRequest, canUnholdRequest};
}

const changeMoneyRequestHoldStatus = (reportAction: OnyxEntry<ReportAction>): void => {
    if (!isMoneyRequestAction(reportAction)) {
        return;
    }
    const moneyRequestReportID = getOriginalMessage(reportAction)?.IOUReportID;

    const moneyRequestReport = getReportOrDraftReport(String(moneyRequestReportID));
    if (!moneyRequestReportID || !moneyRequestReport) {
        return;
    }

    const transactionID = getOriginalMessage(reportAction)?.IOUTransactionID;

    if (!transactionID || !reportAction.childReportID) {
        Log.warn('Missing transactionID and reportAction.childReportID during the change of the money request hold status');
        return;
    }

    const transaction = allTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`] ?? ({} as Transaction);
    const isOnHold = isOnHoldTransactionUtils(transaction);
    const policy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${moneyRequestReport.policyID}`] ?? null;

    if (isOnHold) {
        unholdRequest(transactionID, reportAction.childReportID);
    } else {
        const activeRoute = encodeURIComponent(Navigation.getActiveRoute());
        Navigation.navigate(ROUTES.MONEY_REQUEST_HOLD_REASON.getRoute(policy?.type ?? CONST.POLICY.TYPE.PERSONAL, transactionID, reportAction.childReportID, activeRoute));
    }
};

/**
 * Gets all transactions on an IOU report with a receipt
 */
function getTransactionsWithReceipts(iouReportID: string | undefined): Transaction[] {
    const transactions = getReportTransactions(iouReportID);
    return transactions.filter((transaction) => hasReceiptTransactionUtils(transaction));
}

/**
 * For report previews, we display a "Receipt scan in progress" indicator
 * instead of the report total only when we have no report total ready to show. This is the case when
 * all requests are receipts that are being SmartScanned. As soon as we have a non-receipt request,
 * or as soon as one receipt request is done scanning, we have at least one
 * "ready" expense, and we remove this indicator to show the partial report total.
 */
function areAllRequestsBeingSmartScanned(iouReportID: string | undefined, reportPreviewAction: OnyxEntry<ReportAction>): boolean {
    const transactionsWithReceipts = getTransactionsWithReceipts(iouReportID);
    // If we have more requests than requests with receipts, we have some manual requests
    if (getNumberOfMoneyRequests(reportPreviewAction) > transactionsWithReceipts.length) {
        return false;
    }
    return transactionsWithReceipts.every((transaction) => isScanning(transaction));
}

/**
 * Get the transactions related to a report preview with receipts
 * Get the details linked to the IOU reportAction
 *
 * NOTE: This method is only meant to be used inside this action file. Do not export and use it elsewhere. Use withOnyx or Onyx.connect() instead.
 */
function getLinkedTransaction(reportAction: OnyxEntry<ReportAction | OptimisticIOUReportAction>, transactions?: SearchTransaction[]): OnyxEntry<Transaction> | SearchTransaction {
    let transactionID: string | undefined;

    if (isMoneyRequestAction(reportAction)) {
        transactionID = getOriginalMessage(reportAction)?.IOUTransactionID;
    }

    return transactions ? transactions.find((transaction) => transaction.transactionID === transactionID) : allTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`];
}

/**
 * Check if any of the transactions in the report has required missing fields
 */
function hasMissingSmartscanFields(iouReportID: string | undefined, transactions?: Transaction[]): boolean {
    const reportTransactions = transactions ?? getReportTransactions(iouReportID);

    return reportTransactions.some(hasMissingSmartscanFieldsTransactionUtils);
}

/**
 * Get report action which is missing smartscan fields
 */
function getReportActionWithMissingSmartscanFields(iouReportID: string | undefined): ReportAction | undefined {
    const reportActions = Object.values(getAllReportActions(iouReportID));
    return reportActions.find((action) => {
        if (!isMoneyRequestAction(action)) {
            return false;
        }
        const transaction = getLinkedTransaction(action);
        if (isEmptyObject(transaction)) {
            return false;
        }
        if (!wasActionTakenByCurrentUser(action)) {
            return false;
        }
        return hasMissingSmartscanFieldsTransactionUtils(transaction);
    });
}

/**
 * Check if iouReportID has required missing fields
 */
function shouldShowRBRForMissingSmartscanFields(iouReportID: string | undefined): boolean {
    return !!getReportActionWithMissingSmartscanFields(iouReportID);
}

/**
 * Given a parent IOU report action get report name for the LHN.
 */
function getTransactionReportName({
    reportAction,
    transactions,
    reports,
}: {
    reportAction: OnyxEntry<ReportAction | OptimisticIOUReportAction>;
    transactions?: SearchTransaction[];
    reports?: SearchReport[];
}): string {
    if (isReversedTransaction(reportAction)) {
        return translateLocal('parentReportAction.reversedTransaction');
    }

    if (isDeletedAction(reportAction)) {
        return translateLocal('parentReportAction.deletedExpense');
    }

    const transaction = getLinkedTransaction(reportAction, transactions);

    if (isEmptyObject(transaction)) {
        // Transaction data might be empty on app's first load, if so we fallback to Expense/Track Expense
        return isTrackExpenseAction(reportAction) ? translateLocal('iou.createExpense') : translateLocal('iou.expense');
    }

    if (isScanning(transaction)) {
        return translateLocal('iou.receiptScanning', {count: 1});
    }

    if (hasMissingSmartscanFieldsTransactionUtils(transaction)) {
        return translateLocal('iou.receiptMissingDetails');
    }

    if (isFetchingWaypointsFromServer(transaction) && getMerchant(transaction) === translateLocal('iou.fieldPending')) {
        return translateLocal('iou.fieldPending');
    }

    if (isSentMoneyReportAction(reportAction)) {
        return getIOUReportActionDisplayMessage(reportAction as ReportAction, transaction);
    }

    const report = getReportOrDraftReport(transaction?.reportID, reports);
    const amount = getTransactionAmount(transaction, !isEmptyObject(report) && isExpenseReport(report), transaction?.reportID === CONST.REPORT.UNREPORTED_REPORT_ID) ?? 0;
    const formattedAmount = convertToDisplayString(amount, getCurrency(transaction)) ?? '';
    const comment = getMerchantOrDescription(transaction);

    return translateLocal('iou.threadExpenseReportName', {formattedAmount, comment});
}

/**
 * Get expense message for an IOU report
 *
 * @param [iouReportAction] This is always an IOU action. When necessary, report preview actions will be unwrapped and the child iou report action is passed here (the original report preview
 *     action will be passed as `originalReportAction` in this case).
 * @param [originalReportAction] This can be either a report preview action or the IOU action. This will be the original report preview action in cases where `iouReportAction` was unwrapped
 *     from a report preview action. Otherwise, it will be the same as `iouReportAction`.
 */
function getReportPreviewMessage(
    reportOrID: OnyxInputOrEntry<Report> | string,
    iouReportAction: OnyxInputOrEntry<ReportAction> = null,
    shouldConsiderScanningReceiptOrPendingRoute = false,
    isPreviewMessageForParentChatReport = false,
    policy?: OnyxInputOrEntry<Policy>,
    isForListPreview = false,
    originalReportAction: OnyxInputOrEntry<ReportAction> = iouReportAction,
): string {
    const report = typeof reportOrID === 'string' ? getReport(reportOrID, allReports) : reportOrID;
    const reportActionMessage = getReportActionHtml(iouReportAction);

    if (isEmptyObject(report) || !report?.reportID) {
        // This iouReport may be unavailable for one of the following reasons:
        // 1. After SignIn, the OpenApp API won't return iouReports if they're settled.
        // 2. The iouReport exists in local storage but hasn't been loaded into the allReports. It will be loaded automatically when the user opens the iouReport.
        // Until we know how to solve this the best, we just display the report action message.
        return reportActionMessage;
    }

    const allReportTransactions = getReportTransactions(report.reportID);
    const transactionsWithReceipts = allReportTransactions.filter(hasReceiptTransactionUtils);
    const numberOfScanningReceipts = transactionsWithReceipts.filter(isScanning).length;

    if (!isEmptyObject(iouReportAction) && !isIOUReport(report) && iouReportAction && isSplitBillReportAction(iouReportAction)) {
        // This covers group chats where the last action is a split expense action
        const linkedTransaction = getLinkedTransaction(iouReportAction);
        if (isEmptyObject(linkedTransaction)) {
            return reportActionMessage;
        }

        if (!isEmptyObject(linkedTransaction)) {
            if (isScanning(linkedTransaction)) {
                return translateLocal('iou.receiptScanning', {count: 1});
            }

            if (hasMissingSmartscanFieldsTransactionUtils(linkedTransaction)) {
                return translateLocal('iou.receiptMissingDetails');
            }

            const amount = getTransactionAmount(linkedTransaction, !isEmptyObject(report) && isExpenseReport(report), linkedTransaction?.reportID === CONST.REPORT.UNREPORTED_REPORT_ID) ?? 0;
            const formattedAmount = convertToDisplayString(amount, getCurrency(linkedTransaction)) ?? '';
            return translateLocal('iou.didSplitAmount', {formattedAmount, comment: getMerchantOrDescription(linkedTransaction)});
        }
    }

    if (!isEmptyObject(iouReportAction) && !isIOUReport(report) && !isExpenseReport(report) && iouReportAction && isTrackExpenseAction(iouReportAction)) {
        // This covers group chats where the last action is a track expense action
        const linkedTransaction = getLinkedTransaction(iouReportAction);
        if (isEmptyObject(linkedTransaction)) {
            return reportActionMessage;
        }

        if (!isEmptyObject(linkedTransaction)) {
            if (isScanning(linkedTransaction)) {
                return translateLocal('iou.receiptScanning', {count: 1});
            }

            if (hasMissingSmartscanFieldsTransactionUtils(linkedTransaction)) {
                return translateLocal('iou.receiptMissingDetails');
            }

            const amount = getTransactionAmount(linkedTransaction, !isEmptyObject(report) && isExpenseReport(report), linkedTransaction?.reportID === CONST.REPORT.UNREPORTED_REPORT_ID) ?? 0;
            const formattedAmount = convertToDisplayString(amount, getCurrency(linkedTransaction)) ?? '';
            return translateLocal('iou.trackedAmount', {formattedAmount, comment: getMerchantOrDescription(linkedTransaction)});
        }
    }

    const containsNonReimbursable = hasNonReimbursableTransactions(report.reportID);
    const {totalDisplaySpend: totalAmount, reimbursableSpend} = getMoneyRequestSpendBreakdown(report);

    const parentReport = getParentReport(report);
    const policyName = getPolicyName({report: parentReport ?? report, policy});
    const payerName = isExpenseReport(report) ? policyName : getDisplayNameForParticipant({accountID: report.managerID, shouldUseShortForm: !isPreviewMessageForParentChatReport});

    const formattedAmount = convertToDisplayString(totalAmount, report.currency);

    if (isReportApproved({report}) && isPaidGroupPolicy(report)) {
        return translateLocal('iou.managerApprovedAmount', {
            manager: payerName ?? '',
            amount: formattedAmount,
        });
    }

    let linkedTransaction: OnyxEntry<Transaction>;
    if (!isEmptyObject(iouReportAction) && shouldConsiderScanningReceiptOrPendingRoute && iouReportAction && isMoneyRequestAction(iouReportAction)) {
        linkedTransaction = getLinkedTransaction(iouReportAction);
    }

    if (!isEmptyObject(linkedTransaction) && isScanning(linkedTransaction)) {
        return translateLocal('iou.receiptScanning', {count: numberOfScanningReceipts});
    }

    if (!isEmptyObject(linkedTransaction) && isFetchingWaypointsFromServer(linkedTransaction) && !getTransactionAmount(linkedTransaction)) {
        return translateLocal('iou.fieldPending');
    }

    const originalMessage = !isEmptyObject(iouReportAction) && isMoneyRequestAction(iouReportAction) ? getOriginalMessage(iouReportAction) : undefined;

    // Show Paid preview message if it's settled or if the amount is paid & stuck at receivers end for only chat reports.
    if (isSettled(report.reportID) || (report.isWaitingOnBankAccount && isPreviewMessageForParentChatReport)) {
        const formattedReimbursableAmount = convertToDisplayString(reimbursableSpend, report.currency);
        // A settled report preview message can come in three formats "paid ... elsewhere" or "paid ... with Expensify"
        let translatePhraseKey: TranslationPaths = 'iou.paidElsewhere';
        if (isPreviewMessageForParentChatReport) {
            translatePhraseKey = 'iou.payerPaidAmount';
        } else if (
            [CONST.IOU.PAYMENT_TYPE.VBBA, CONST.IOU.PAYMENT_TYPE.EXPENSIFY].some((paymentType) => paymentType === originalMessage?.paymentType) ||
            !!reportActionMessage.match(/ (with Expensify|using Expensify)$/) ||
            report.isWaitingOnBankAccount
        ) {
            translatePhraseKey = 'iou.paidWithExpensify';
            if (originalMessage?.automaticAction) {
                translatePhraseKey = 'iou.automaticallyPaidWithExpensify';
            }
        }

        let actualPayerName = report.managerID === currentUserAccountID ? '' : getDisplayNameForParticipant({accountID: report.managerID, shouldUseShortForm: true});
        actualPayerName = actualPayerName && isForListPreview && !isPreviewMessageForParentChatReport ? `${actualPayerName}:` : actualPayerName;
        const payerDisplayName = isPreviewMessageForParentChatReport ? payerName : actualPayerName;

        return translateLocal(translatePhraseKey, {amount: formattedReimbursableAmount, payer: payerDisplayName ?? ''});
    }

    if (report.isWaitingOnBankAccount) {
        const submitterDisplayName = getDisplayNameForParticipant({accountID: report.ownerAccountID, shouldUseShortForm: true}) ?? '';
        return translateLocal('iou.waitingOnBankAccount', {submitterDisplayName});
    }

    const lastActorID = iouReportAction?.actorAccountID;
    let amount = originalMessage?.amount;
    let currency = originalMessage?.currency ? originalMessage?.currency : report.currency;

    if (!isEmptyObject(linkedTransaction)) {
        amount = getTransactionAmount(linkedTransaction, isExpenseReport(report));
        currency = getCurrency(linkedTransaction);
    }

    if (isEmptyObject(linkedTransaction) && !isEmptyObject(iouReportAction)) {
        linkedTransaction = getLinkedTransaction(iouReportAction);
    }

    let comment = !isEmptyObject(linkedTransaction) ? getMerchantOrDescription(linkedTransaction) : undefined;
    if (!isEmptyObject(originalReportAction) && isReportPreviewAction(originalReportAction) && getNumberOfMoneyRequests(originalReportAction) !== 1) {
        comment = undefined;
    }

    // if we have the amount in the originalMessage and lastActorID, we can use that to display the preview message for the latest expense
    if (amount !== undefined && lastActorID && !isPreviewMessageForParentChatReport) {
        const amountToDisplay = convertToDisplayString(Math.abs(amount), currency);

        // We only want to show the actor name in the preview if it's not the current user who took the action
        const requestorName =
            lastActorID && lastActorID !== currentUserAccountID ? getDisplayNameForParticipant({accountID: lastActorID, shouldUseShortForm: !isPreviewMessageForParentChatReport}) : '';
        return `${requestorName ? `${requestorName}: ` : ''}${translateLocal('iou.expenseAmount', {formattedAmount: amountToDisplay, comment})}`;
    }

    if (containsNonReimbursable) {
        return translateLocal('iou.payerSpentAmount', {payer: getDisplayNameForParticipant({accountID: report.ownerAccountID}) ?? '', amount: formattedAmount});
    }

    return translateLocal('iou.payerOwesAmount', {payer: payerName ?? '', amount: formattedAmount, comment});
}

/**
 * Given the updates user made to the expense, compose the originalMessage
 * object of the modified expense action.
 *
 * At the moment, we only allow changing one transaction field at a time.
 */
function getModifiedExpenseOriginalMessage(
    oldTransaction: OnyxInputOrEntry<Transaction>,
    transactionChanges: TransactionChanges,
    isFromExpenseReport: boolean,
    policy: OnyxInputOrEntry<Policy>,
    updatedTransaction?: OnyxInputOrEntry<Transaction>,
): OriginalMessageModifiedExpense {
    const originalMessage: OriginalMessageModifiedExpense = {};
    // Remark: Comment field is the only one which has new/old prefixes for the keys (newComment/ oldComment),
    // all others have old/- pattern such as oldCreated/created
    if ('comment' in transactionChanges) {
        originalMessage.oldComment = getDescription(oldTransaction);
        originalMessage.newComment = transactionChanges?.comment;
    }
    if ('created' in transactionChanges) {
        originalMessage.oldCreated = getFormattedCreated(oldTransaction);
        originalMessage.created = transactionChanges?.created;
    }
    if ('merchant' in transactionChanges) {
        originalMessage.oldMerchant = getMerchant(oldTransaction);
        originalMessage.merchant = transactionChanges?.merchant;
    }
    if ('attendees' in transactionChanges) {
        originalMessage.oldAttendees = getAttendees(oldTransaction);
        originalMessage.newAttendees = transactionChanges?.attendees;
    }

    // The amount is always a combination of the currency and the number value so when one changes we need to store both
    // to match how we handle the modified expense action in oldDot
    const didAmountOrCurrencyChange = 'amount' in transactionChanges || 'currency' in transactionChanges;
    if (didAmountOrCurrencyChange) {
        originalMessage.oldAmount = getTransactionAmount(oldTransaction, isFromExpenseReport);
        originalMessage.amount = transactionChanges?.amount ?? transactionChanges.oldAmount;
        originalMessage.oldCurrency = getCurrency(oldTransaction);
        originalMessage.currency = transactionChanges?.currency ?? transactionChanges.oldCurrency;
    }

    if ('category' in transactionChanges) {
        originalMessage.oldCategory = getCategory(oldTransaction);
        originalMessage.category = transactionChanges?.category;
    }

    if ('tag' in transactionChanges) {
        originalMessage.oldTag = getTag(oldTransaction);
        originalMessage.tag = transactionChanges?.tag;
    }

    // We only want to display a tax rate update system message when tax rate is updated by user.
    // Tax rate can change as a result of currency update. In such cases, we want to skip displaying a system message, as discussed.
    const didTaxCodeChange = 'taxCode' in transactionChanges;
    if (didTaxCodeChange && !didAmountOrCurrencyChange) {
        originalMessage.oldTaxRate = policy?.taxRates?.taxes[getTaxCode(oldTransaction)]?.value;
        originalMessage.taxRate = transactionChanges?.taxCode && policy?.taxRates?.taxes[transactionChanges?.taxCode]?.value;
    }

    // We only want to display a tax amount update system message when tax amount is updated by user.
    // Tax amount can change as a result of amount, currency or tax rate update. In such cases, we want to skip displaying a system message, as discussed.
    if ('taxAmount' in transactionChanges && !(didAmountOrCurrencyChange || didTaxCodeChange)) {
        originalMessage.oldTaxAmount = getTaxAmount(oldTransaction, isFromExpenseReport);
        originalMessage.taxAmount = transactionChanges?.taxAmount;
        originalMessage.currency = getCurrency(oldTransaction);
    }

    if ('billable' in transactionChanges) {
        const oldBillable = getBillable(oldTransaction);
        originalMessage.oldBillable = oldBillable ? translateLocal('common.billable').toLowerCase() : translateLocal('common.nonBillable').toLowerCase();
        originalMessage.billable = transactionChanges?.billable ? translateLocal('common.billable').toLowerCase() : translateLocal('common.nonBillable').toLowerCase();
    }

    if ('customUnitRateID' in transactionChanges && updatedTransaction?.comment?.customUnit?.customUnitRateID) {
        originalMessage.oldAmount = getTransactionAmount(oldTransaction, isFromExpenseReport);
        originalMessage.oldCurrency = getCurrency(oldTransaction);
        originalMessage.oldMerchant = getMerchant(oldTransaction);

        // For the originalMessage, we should use the non-negative amount, similar to what getAmount does for oldAmount
        originalMessage.amount = Math.abs(updatedTransaction.modifiedAmount ?? 0);
        originalMessage.currency = updatedTransaction.modifiedCurrency ?? CONST.CURRENCY.USD;
        originalMessage.merchant = updatedTransaction.modifiedMerchant;
    }

    return originalMessage;
}

/**
 * Check if original message is an object and can be used as a ChangeLog type
 * @param originalMessage
 */
function isChangeLogObject(originalMessage?: OriginalMessageChangeLog): OriginalMessageChangeLog | undefined {
    if (originalMessage && typeof originalMessage === 'object') {
        return originalMessage;
    }
    return undefined;
}

/**
 * Build invited usernames for admin chat threads
 * @param parentReportAction
 * @param parentReportActionMessage
 */
function getAdminRoomInvitedParticipants(parentReportAction: OnyxEntry<ReportAction>, parentReportActionMessage: string) {
    if (isEmptyObject(parentReportAction)) {
        return parentReportActionMessage || translateLocal('parentReportAction.deletedMessage');
    }
    if (!getOriginalMessage(parentReportAction)) {
        return parentReportActionMessage || translateLocal('parentReportAction.deletedMessage');
    }
    if (!isPolicyChangeLogAction(parentReportAction) && !isRoomChangeLogAction(parentReportAction)) {
        return parentReportActionMessage || translateLocal('parentReportAction.deletedMessage');
    }

    const originalMessage = isChangeLogObject(getOriginalMessage(parentReportAction));
    const personalDetails = getPersonalDetailsByIDs({accountIDs: originalMessage?.targetAccountIDs ?? [], currentUserAccountID: 0});

    const participants = personalDetails.map((personalDetail) => {
        const name = getEffectiveDisplayName(personalDetail);
        if (name && name?.length > 0) {
            return name;
        }
        return translateLocal('common.hidden');
    });
    const users = participants.length > 1 ? participants.join(` ${translateLocal('common.and')} `) : participants.at(0);
    if (!users) {
        return parentReportActionMessage;
    }
    const actionType = parentReportAction.actionName;
    const isInviteAction = actionType === CONST.REPORT.ACTIONS.TYPE.ROOM_CHANGE_LOG.INVITE_TO_ROOM || actionType === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.INVITE_TO_ROOM;

    const verbKey = isInviteAction ? 'workspace.invite.invited' : 'workspace.invite.removed';
    const prepositionKey = isInviteAction ? 'workspace.invite.to' : 'workspace.invite.from';

    const verb = translateLocal(verbKey);
    const preposition = translateLocal(prepositionKey);

    const roomName = originalMessage?.roomName ?? '';

    return roomName ? `${verb} ${users} ${preposition} ${roomName}` : `${verb} ${users}`;
}

/**
 * Get the invoice payer name based on its type:
 * - Individual - a receiver display name.
 * - Policy - a receiver policy name.
 */
function getInvoicePayerName(report: OnyxEntry<Report>, invoiceReceiverPolicy?: OnyxEntry<Policy> | SearchPolicy, invoiceReceiverPersonalDetail?: PersonalDetails | null): string {
    const invoiceReceiver = report?.invoiceReceiver;
    const isIndividual = invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL;

    if (isIndividual) {
        return formatPhoneNumber(getDisplayNameOrDefault(invoiceReceiverPersonalDetail ?? allPersonalDetails?.[invoiceReceiver.accountID]));
    }

    return getPolicyName({report, policy: invoiceReceiverPolicy ?? allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${invoiceReceiver?.policyID}`]});
}

/**
 * Parse html of reportAction into text
 */
function parseReportActionHtmlToText(reportAction: OnyxEntry<ReportAction>, reportID: string | undefined, childReportID?: string): string {
    if (!reportAction) {
        return '';
    }
    const key = `${reportID}_${reportAction.reportActionID}_${reportAction.lastModified}`;
    const cachedText = parsedReportActionMessageCache[key];
    if (cachedText !== undefined) {
        return cachedText;
    }

    const {html, text} = getReportActionMessageReportUtils(reportAction) ?? {};

    if (!html) {
        return text ?? '';
    }

    const mentionReportRegex = /<mention-report reportID="?(\d+)"?(?: *\/>|><\/mention-report>)/gi;
    const matches = html.matchAll(mentionReportRegex);

    const reportIDToName: Record<string, string> = {};
    for (const match of matches) {
        if (match[1] !== childReportID) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            reportIDToName[match[1]] = getReportName(getReportOrDraftReport(match[1])) ?? '';
        }
    }

    const mentionUserRegex = /(?:<mention-user accountID="?(\d+)"?(?: *\/>|><\/mention-user>))/gi;
    const accountIDToName: Record<string, string> = {};
    const accountIDs = Array.from(html.matchAll(mentionUserRegex), (mention) => Number(mention[1]));
    const logins = getLoginsByAccountIDs(accountIDs);
    accountIDs.forEach((id, index) => {
        const login = logins.at(index);
        const user = allPersonalDetails?.[id];
        const displayName = formatPhoneNumber(login ?? '') || getDisplayNameOrDefault(user);
        accountIDToName[id] = getShortMentionIfFound(displayName, id.toString(), currentUserPersonalDetails, login) ?? '';
    });

    const textMessage = Str.removeSMSDomain(Parser.htmlToText(html, {reportIDToName, accountIDToName}));
    parsedReportActionMessageCache[key] = textMessage;

    return textMessage;
}

/**
 * Get the report action message for a report action.
 */
function getReportActionMessage({
    reportAction,
    reportID,
    childReportID,
    reports,
    personalDetails,
}: {
    reportAction: OnyxEntry<ReportAction>;
    reportID?: string;
    childReportID?: string;
    reports?: SearchReport[];
    personalDetails?: Partial<PersonalDetailsList>;
}) {
    if (isEmptyObject(reportAction)) {
        return '';
    }
    if (reportAction.actionName === CONST.REPORT.ACTIONS.TYPE.HOLD) {
        return translateLocal('iou.heldExpense');
    }

    if (reportAction.actionName === CONST.REPORT.ACTIONS.TYPE.EXPORTED_TO_INTEGRATION) {
        return getExportIntegrationLastMessageText(reportAction);
    }

    if (reportAction.actionName === CONST.REPORT.ACTIONS.TYPE.UNHOLD) {
        return translateLocal('iou.unheldExpense');
    }
    if (isApprovedOrSubmittedReportAction(reportAction) || isActionOfType(reportAction, CONST.REPORT.ACTIONS.TYPE.REIMBURSED)) {
        return getReportActionMessageText(reportAction);
    }
    if (isReimbursementQueuedAction(reportAction)) {
        return getReimbursementQueuedActionMessage({
            reportAction,
            reportOrID: getReportOrDraftReport(reportID, reports),
            shouldUseShortDisplayName: false,
            reports,
            personalDetails,
        });
    }
    if (reportAction.actionName === CONST.REPORT.ACTIONS.TYPE.RECEIPT_SCAN_FAILED) {
        return translateLocal('receipt.scanFailed');
    }

    if (isReimbursementDeQueuedOrCanceledAction(reportAction)) {
        return getReimbursementDeQueuedOrCanceledActionMessage(reportAction, getReportOrDraftReport(reportID, reports));
    }

    return parseReportActionHtmlToText(reportAction, reportID, childReportID);
}

/**
 * Get the title for an invoice room.
 */
function getInvoicesChatName({
    report,
    receiverPolicy,
    personalDetails,
    policies,
}: {
    report: OnyxEntry<Report>;
    receiverPolicy: OnyxEntry<Policy> | SearchPolicy;
    personalDetails?: Partial<PersonalDetailsList>;
    policies?: SearchPolicy[];
}): string {
    const invoiceReceiver = report?.invoiceReceiver;
    const isIndividual = invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL;
    const invoiceReceiverAccountID = isIndividual ? invoiceReceiver.accountID : CONST.DEFAULT_NUMBER_ID;
    const invoiceReceiverPolicyID = isIndividual ? undefined : invoiceReceiver?.policyID;
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const invoiceReceiverPolicy = receiverPolicy ?? getPolicy(invoiceReceiverPolicyID);
    const isCurrentUserReceiver = (isIndividual && invoiceReceiverAccountID === currentUserAccountID) || (!isIndividual && isPolicyAdminPolicyUtils(invoiceReceiverPolicy));

    if (isCurrentUserReceiver) {
        return getPolicyName({report, policies});
    }

    if (isIndividual) {
        return formatPhoneNumber(getDisplayNameOrDefault((personalDetails ?? allPersonalDetails)?.[invoiceReceiverAccountID]));
    }

    return getPolicyName({report, policy: invoiceReceiverPolicy, policies});
}

/**
 * Generates a report title using the names of participants, excluding the current user.
 * This function is useful in contexts such as 1:1 direct messages (DMs) or other group chats.
 * It limits to a maximum of 5 participants for the title and uses short names unless there is only one participant.
 */
const buildReportNameFromParticipantNames = ({report, personalDetails: personalDetailsData}: {report: OnyxEntry<Report>; personalDetails?: Partial<PersonalDetailsList>}) =>
    Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((id) => id !== currentUserAccountID)
        .slice(0, 5)
        .map((accountID) => ({
            accountID,
            name: getDisplayNameForParticipant({
                accountID,
                shouldUseShortForm: true,
                personalDetailsData,
            }),
        }))
        .filter((participant) => participant.name)
        .reduce((formattedNames, {name, accountID}, _, array) => {
            // If there is only one participant (if it is 0 or less the function will return empty string), return their full name
            if (array.length < 2) {
                return getDisplayNameForParticipant({
                    accountID,
                    personalDetailsData,
                });
            }
            return formattedNames ? `${formattedNames}, ${name}` : name;
        }, '');

function generateReportName(report: OnyxEntry<Report>): string {
    if (!report) {
        return '';
    }
    return getReportNameInternal({report});
}

/**
 * Get the title for a report.
 */
function getReportName(
    report: OnyxEntry<Report>,
    policy?: OnyxEntry<Policy>,
    parentReportActionParam?: OnyxInputOrEntry<ReportAction>,
    personalDetails?: Partial<PersonalDetailsList>,
    invoiceReceiverPolicy?: OnyxEntry<Policy>,
    reportAttributes?: ReportAttributesDerivedValue['reports'],
): string {
    // Check if we can use report name in derived values - only when we have report but no other params
    const canUseDerivedValue = report && policy === undefined && parentReportActionParam === undefined && personalDetails === undefined && invoiceReceiverPolicy === undefined;
    const attributes = reportAttributes ?? reportAttributesDerivedValue;
    const derivedNameExists = report && !!attributes?.[report.reportID]?.reportName;
    if (canUseDerivedValue && derivedNameExists) {
        return attributes[report.reportID].reportName;
    }
    return getReportNameInternal({report, policy, parentReportActionParam, personalDetails, invoiceReceiverPolicy});
}

function getSearchReportName(props: GetReportNameParams): string {
    const {report, policy} = props;
    if (isChatThread(report) && policy?.name) {
        return policy.name;
    }
    return getReportNameInternal(props);
}

function getInvoiceReportName(report: OnyxEntry<Report>, policy?: OnyxEntry<Policy | SearchPolicy>, invoiceReceiverPolicy?: OnyxEntry<Policy | SearchPolicy>): string {
    const moneyRequestReportName = getMoneyRequestReportName({report, policy, invoiceReceiverPolicy});
    const oldDotInvoiceName = report?.reportName ?? moneyRequestReportName;
    return isNewDotInvoice(report?.chatReportID) ? moneyRequestReportName : oldDotInvoiceName;
}

function generateArchivedReportName(reportName: string): string {
    return `${reportName} (${translateLocal('common.archived')}) `;
}

function getReportNameInternal({
    report,
    policy,
    parentReportActionParam,
    personalDetails,
    invoiceReceiverPolicy,
    transactions,
    reports,
    reportNameValuePairs = allReportNameValuePair,
    policies,
}: GetReportNameParams): string {
    let formattedName: string | undefined;
    let parentReportAction: OnyxEntry<ReportAction>;
    if (parentReportActionParam) {
        parentReportAction = parentReportActionParam;
    } else {
        parentReportAction = isThread(report) ? allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.parentReportID}`]?.[report.parentReportActionID] : undefined;
    }
    const parentReportActionMessage = getReportActionMessageReportUtils(parentReportAction);
    const isArchivedNonExpense = isArchivedNonExpenseReport(
        report,
        !!reportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report?.reportID ?? String(CONST.DEFAULT_NUMBER_ID)}`]?.private_isArchived,
    );

    if (
        isActionOfType(parentReportAction, CONST.REPORT.ACTIONS.TYPE.SUBMITTED) ||
        isActionOfType(parentReportAction, CONST.REPORT.ACTIONS.TYPE.SUBMITTED_AND_CLOSED) ||
        isMarkAsClosedAction(parentReportAction)
    ) {
        const harvesting = !isMarkAsClosedAction(parentReportAction) ? (getOriginalMessage(parentReportAction)?.harvesting ?? false) : false;
        if (harvesting) {
            return translateLocal('iou.automaticallySubmitted');
        }
        return translateLocal('iou.submitted');
    }
    if (isActionOfType(parentReportAction, CONST.REPORT.ACTIONS.TYPE.FORWARDED)) {
        const {automaticAction} = getOriginalMessage(parentReportAction) ?? {};
        if (automaticAction) {
            return translateLocal('iou.automaticallyForwarded');
        }
        return translateLocal('iou.forwarded');
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.REJECTED) {
        return getRejectedReportMessage();
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.RETRACTED) {
        return getRetractedMessage();
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.REOPENED) {
        return getReopenedMessage();
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.CORPORATE_UPGRADE) {
        return getUpgradeWorkspaceMessage();
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.TEAM_DOWNGRADE) {
        return getDowngradeWorkspaceMessage();
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_CURRENCY) {
        return getWorkspaceCurrencyUpdateMessage(parentReportAction);
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_FIELD) {
        return getWorkspaceUpdateFieldMessage(parentReportAction);
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.MERGED_WITH_CASH_TRANSACTION) {
        return translateLocal('systemMessage.mergedWithCashTransaction');
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_NAME) {
        return Str.htmlDecode(getWorkspaceNameUpdatedMessage(parentReportAction));
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_AUTO_REPORTING_FREQUENCY) {
        return getWorkspaceFrequencyUpdateMessage(parentReportAction);
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.ADD_REPORT_FIELD) {
        return getWorkspaceReportFieldAddMessage(parentReportAction);
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_REPORT_FIELD) {
        return getWorkspaceReportFieldUpdateMessage(parentReportAction);
    }
    if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.DELETE_REPORT_FIELD) {
        return getWorkspaceReportFieldDeleteMessage(parentReportAction);
    }

    if (isActionOfType(parentReportAction, CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_MAX_EXPENSE_AMOUNT_NO_RECEIPT)) {
        return getPolicyChangeLogMaxExpenseAmountNoReceiptMessage(parentReportAction);
    }

    if (isActionOfType(parentReportAction, CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_DEFAULT_BILLABLE)) {
        return getPolicyChangeLogDefaultBillableMessage(parentReportAction);
    }
    if (isActionOfType(parentReportAction, CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_DEFAULT_TITLE_ENFORCED)) {
        return getPolicyChangeLogDefaultTitleEnforcedMessage(parentReportAction);
    }

    if (isActionOfType(parentReportAction, CONST.REPORT.ACTIONS.TYPE.CHANGE_POLICY)) {
        return getPolicyChangeMessage(parentReportAction);
    }

    if (isMoneyRequestAction(parentReportAction)) {
        const originalMessage = getOriginalMessage(parentReportAction);
        if (originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.PAY) {
            if (originalMessage.paymentType === CONST.IOU.PAYMENT_TYPE.ELSEWHERE) {
                return translateLocal('iou.paidElsewhere');
            }
            if (originalMessage.paymentType === CONST.IOU.PAYMENT_TYPE.VBBA || originalMessage.paymentType === CONST.IOU.PAYMENT_TYPE.EXPENSIFY) {
                if (originalMessage.automaticAction) {
                    return translateLocal('iou.automaticallyPaidWithExpensify');
                }
                return translateLocal('iou.paidWithExpensify');
            }
        }
    }

    if (isActionOfType(parentReportAction, CONST.REPORT.ACTIONS.TYPE.APPROVED)) {
        const {automaticAction} = getOriginalMessage(parentReportAction) ?? {};
        if (automaticAction) {
            return translateLocal('iou.automaticallyApproved');
        }
        return translateLocal('iou.approvedMessage');
    }
    if (isUnapprovedAction(parentReportAction)) {
        return translateLocal('iou.unapproved');
    }

    if (isActionableJoinRequest(parentReportAction)) {
        return getJoinRequestMessage(parentReportAction);
    }

    if (isTaskReport(report) && isCanceledTaskReport(report, parentReportAction)) {
        return translateLocal('parentReportAction.deletedTask');
    }

    if (isTaskReport(report)) {
        return Parser.htmlToText(report?.reportName ?? '').trim();
    }

    if (isActionOfType(parentReportAction, CONST.REPORT.ACTIONS.TYPE.INTEGRATION_SYNC_FAILED)) {
        return getIntegrationSyncFailedMessage(parentReportAction, report?.policyID);
    }

    if (isActionOfType(parentReportAction, CONST.REPORT.ACTIONS.TYPE.TRAVEL_UPDATE)) {
        return getTravelUpdateMessage(parentReportAction);
    }

    if (isChatThread(report)) {
        if (!isEmptyObject(parentReportAction) && isTransactionThread(parentReportAction)) {
            formattedName = getTransactionReportName({reportAction: parentReportAction, transactions, reports});

            // This will get removed as part of https://github.com/Expensify/App/issues/59961
            // eslint-disable-next-line deprecation/deprecation
            if (isArchivedNonExpense) {
                formattedName = generateArchivedReportName(formattedName);
            }
            return formatReportLastMessageText(formattedName);
        }

        if (!isEmptyObject(parentReportAction) && isOldDotReportAction(parentReportAction)) {
            return getMessageOfOldDotReportAction(parentReportAction);
        }

        if (isRenamedAction(parentReportAction)) {
            return getRenamedAction(parentReportAction, isExpenseReport(getReport(report.parentReportID, allReports)));
        }

        if (parentReportActionMessage?.isDeletedParentAction) {
            return translateLocal('parentReportAction.deletedMessage');
        }

        if (parentReportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.RESOLVED_DUPLICATES) {
            return translateLocal('violations.resolvedDuplicates');
        }

        const isAttachment = isReportActionAttachment(!isEmptyObject(parentReportAction) ? parentReportAction : undefined);
        const reportActionMessage = getReportActionMessage({
            reportAction: parentReportAction,
            reportID: report?.parentReportID,
            childReportID: report?.reportID,
            reports,
            personalDetails,
        }).replace(/(\n+|\r\n|\n|\r)/gm, ' ');
        if (isAttachment && reportActionMessage) {
            return `[${translateLocal('common.attachment')}]`;
        }
        if (
            parentReportActionMessage?.moderationDecision?.decision === CONST.MODERATION.MODERATOR_DECISION_PENDING_HIDE ||
            parentReportActionMessage?.moderationDecision?.decision === CONST.MODERATION.MODERATOR_DECISION_HIDDEN ||
            parentReportActionMessage?.moderationDecision?.decision === CONST.MODERATION.MODERATOR_DECISION_PENDING_REMOVE
        ) {
            return translateLocal('parentReportAction.hiddenMessage');
        }
        if (isAdminRoom(report) || isUserCreatedPolicyRoom(report)) {
            return getAdminRoomInvitedParticipants(parentReportAction, reportActionMessage);
        }

        // This will get removed as part of https://github.com/Expensify/App/issues/59961
        // eslint-disable-next-line deprecation/deprecation
        if (reportActionMessage && isArchivedNonExpense) {
            return generateArchivedReportName(reportActionMessage);
        }
        if (!isEmptyObject(parentReportAction) && isModifiedExpenseAction(parentReportAction)) {
            const modifiedMessage = ModifiedExpenseMessage.getForReportAction({reportOrID: report?.reportID, reportAction: parentReportAction, searchReports: reports});
            return formatReportLastMessageText(modifiedMessage);
        }
        if (isTripRoom(report) && report?.reportName !== CONST.REPORT.DEFAULT_REPORT_NAME) {
            return report?.reportName ?? '';
        }
        if (isCardIssuedAction(parentReportAction)) {
            return getCardIssuedMessage({reportAction: parentReportAction});
        }
        return reportActionMessage;
    }

    if (isClosedExpenseReportWithNoExpenses(report, transactions)) {
        return translateLocal('parentReportAction.deletedReport');
    }

    if (isGroupChat(report)) {
        return getGroupChatName(undefined, true, report) ?? '';
    }

    if (isChatRoom(report)) {
        formattedName = report?.reportName;
    }

    if (isPolicyExpenseChat(report)) {
        formattedName = getPolicyExpenseChatName({report, policy, personalDetailsList: personalDetails, reports});
    }

    if (isMoneyRequestReport(report)) {
        formattedName = getMoneyRequestReportName({report, policy});
    }

    if (isInvoiceReport(report)) {
        formattedName = getInvoiceReportName(report, policy, invoiceReceiverPolicy);
    }

    if (isInvoiceRoom(report)) {
        formattedName = getInvoicesChatName({report, receiverPolicy: invoiceReceiverPolicy, personalDetails, policies});
    }

    if (isSelfDM(report)) {
        formattedName = getDisplayNameForParticipant({accountID: currentUserAccountID, shouldAddCurrentUserPostfix: true, personalDetailsData: personalDetails});
    }

    if (formattedName) {
        return formatReportLastMessageText(isArchivedNonExpense ? generateArchivedReportName(formattedName) : formattedName);
    }

    // Not a room or PolicyExpenseChat, generate title from first 5 other participants
    formattedName = buildReportNameFromParticipantNames({report, personalDetails});

    return isArchivedNonExpense ? generateArchivedReportName(formattedName) : formattedName;
}

/**
 * Get the payee name given a report.
 */
function getPayeeName(report: OnyxEntry<Report>): string | undefined {
    if (isEmptyObject(report)) {
        return undefined;
    }

    const participantsWithoutCurrentUser = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserAccountID);

    if (participantsWithoutCurrentUser.length === 0) {
        return undefined;
    }
    return getDisplayNameForParticipant({accountID: participantsWithoutCurrentUser.at(0), shouldUseShortForm: true});
}

function getReportSubtitlePrefix(report: OnyxEntry<Report>): string {
    if ((!isChatRoom(report) && !isPolicyExpenseChat(report)) || isThread(report)) {
        return '';
    }

    const filteredPolicies = Object.values(allPolicies ?? {}).filter((policy) => shouldShowPolicy(policy, false, currentUserEmail));
    if (filteredPolicies.length < 2) {
        return '';
    }

    const policyName = getPolicyName({report, returnEmptyIfNotFound: true});
    if (!policyName) {
        return '';
    }
    return `${policyName} ${CONST.DOT_SEPARATOR} `;
}

/**
 * Get either the policyName or domainName the chat is tied to
 */
function getChatRoomSubtitle(report: OnyxEntry<Report>, config: GetChatRoomSubtitleConfig = {isCreateExpenseFlow: false}): string | undefined {
    if (isChatThread(report)) {
        return '';
    }
    if (isSelfDM(report)) {
        return translateLocal('reportActionsView.yourSpace');
    }
    if (isInvoiceRoom(report)) {
        return translateLocal('workspace.common.invoices');
    }
    if (isConciergeChatReport(report)) {
        return translateLocal('reportActionsView.conciergeSupport');
    }
    if (!isDefaultRoom(report) && !isUserCreatedPolicyRoom(report) && !isPolicyExpenseChat(report)) {
        return '';
    }
    if (getChatType(report) === CONST.REPORT.CHAT_TYPE.DOMAIN_ALL) {
        // The domainAll rooms are just #domainName, so we ignore the prefix '#' to get the domainName
        return report?.reportName?.substring(1) ?? '';
    }
    if ((isPolicyExpenseChat(report) && !!report?.isOwnPolicyExpenseChat) || isExpenseReport(report)) {
        const policy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];
        const submitToAccountID = getSubmitToAccountID(policy, report);
        const submitsToAccountDetails = allPersonalDetails?.[submitToAccountID];
        const subtitle = submitsToAccountDetails?.displayName ?? submitsToAccountDetails?.login;

        if (!subtitle || !config.isCreateExpenseFlow) {
            return getPolicyName({report});
        }

        return `${getReportSubtitlePrefix(report)}${translateLocal('iou.submitsTo', {name: subtitle ?? ''})}`;
    }

    // This will get removed as part of https://github.com/Expensify/App/issues/59961
    // eslint-disable-next-line deprecation/deprecation
    if (isArchivedReport(getReportNameValuePairs(report?.reportID))) {
        return report?.oldPolicyName ?? '';
    }
    return getPolicyName({report});
}

/**
 * Get pending members for reports
 */
function getPendingChatMembers(accountIDs: number[], previousPendingChatMembers: PendingChatMember[], pendingAction: PendingAction): PendingChatMember[] {
    const pendingChatMembers = accountIDs.map((accountID) => ({accountID: accountID.toString(), pendingAction}));
    return [...previousPendingChatMembers, ...pendingChatMembers];
}

/**
 * Gets the parent navigation subtitle for the report
 */
function getParentNavigationSubtitle(report: OnyxEntry<Report>, invoiceReceiverPolicy?: OnyxEntry<Policy>): ParentNavigationSummaryParams {
    const parentReport = getParentReport(report);
    if (isEmptyObject(parentReport)) {
        return {};
    }

    if (isInvoiceReport(report) || isInvoiceRoom(parentReport)) {
        let reportName = `${getPolicyName({report: parentReport})} & ${getInvoicePayerName(parentReport, invoiceReceiverPolicy)}`;

        // This will get removed as part of https://github.com/Expensify/App/issues/59961
        // eslint-disable-next-line deprecation/deprecation
        if (isArchivedNonExpenseReport(parentReport, !!getReportNameValuePairs(parentReport?.reportID)?.private_isArchived)) {
            reportName += ` (${translateLocal('common.archived')})`;
        }

        return {
            reportName,
        };
    }

    return {
        reportName: getReportName(parentReport),
        workspaceName: getPolicyName({report: parentReport, returnEmptyIfNotFound: true}),
    };
}

/**
 * Navigate to the details page of a given report
 */
function navigateToDetailsPage(report: OnyxEntry<Report>, backTo?: string, shouldUseActiveRoute?: boolean) {
    const isSelfDMReport = isSelfDM(report);
    const isOneOnOneChatReport = isOneOnOneChat(report);
    const participantAccountID = getParticipantsAccountIDsForDisplay(report);

    if (isSelfDMReport || isOneOnOneChatReport) {
        Navigation.navigate(ROUTES.PROFILE.getRoute(participantAccountID.at(0), isSelfDMReport || shouldUseActiveRoute ? Navigation.getActiveRoute() : backTo));
        return;
    }

    if (report?.reportID) {
        Navigation.navigate(ROUTES.REPORT_WITH_ID_DETAILS.getRoute(report?.reportID, backTo));
    }
}

/**
 * Go back to the details page of a given report
 */
function goBackToDetailsPage(report: OnyxEntry<Report>, backTo?: string, shouldGoBackToDetailsPage = false) {
    const isOneOnOneChatReport = isOneOnOneChat(report);
    const participantAccountID = getParticipantsAccountIDsForDisplay(report);

    if (isOneOnOneChatReport) {
        Navigation.goBack(ROUTES.PROFILE.getRoute(participantAccountID.at(0), backTo));
        return;
    }

    if (report?.reportID) {
        if (shouldGoBackToDetailsPage) {
            Navigation.goBack(ROUTES.REPORT_WITH_ID_DETAILS.getRoute(report.reportID, backTo));
        } else {
            Navigation.goBack(ROUTES.REPORT_SETTINGS.getRoute(report.reportID, backTo));
        }
    } else {
        Log.warn('Missing reportID during navigation back to the details page');
    }
}

function navigateBackOnDeleteTransaction(backRoute: Route | undefined, isFromRHP?: boolean) {
    if (!backRoute) {
        return;
    }

    const rootState = navigationRef.current?.getRootState();
    const lastFullScreenRoute = rootState?.routes.findLast((route) => isFullScreenName(route.name));
    if (lastFullScreenRoute?.name === NAVIGATORS.SEARCH_FULLSCREEN_NAVIGATOR) {
        Navigation.dismissModal();
        return;
    }
    if (isFromRHP) {
        Navigation.dismissModal();
    }
    Navigation.isNavigationReady().then(() => {
        Navigation.goBack(backRoute);
    });
}

/**
 * Go back to the previous page from the edit private page of a given report
 */
function goBackFromPrivateNotes(report: OnyxEntry<Report>, accountID?: number, backTo?: string) {
    if (isEmpty(report) || !accountID) {
        return;
    }
    const currentUserPrivateNote = report.privateNotes?.[accountID]?.note ?? '';
    if (isEmpty(currentUserPrivateNote)) {
        const participantAccountIDs = getParticipantsAccountIDsForDisplay(report);

        if (isOneOnOneChat(report)) {
            Navigation.goBack(ROUTES.PROFILE.getRoute(participantAccountIDs.at(0), backTo));
            return;
        }

        if (report?.reportID) {
            Navigation.goBack(ROUTES.REPORT_WITH_ID_DETAILS.getRoute(report?.reportID, backTo));
            return;
        }
    }
    Navigation.goBack(ROUTES.PRIVATE_NOTES_LIST.getRoute(report.reportID, backTo));
}

function navigateOnDeleteExpense(backToRoute: Route) {
    const rootState = navigationRef.getRootState();
    const focusedRoute = findFocusedRoute(rootState);
    if (focusedRoute?.params && 'backTo' in focusedRoute.params) {
        Navigation.goBack(focusedRoute.params.backTo as Route);
        return;
    }

    Navigation.goBack(backToRoute);
}

/**
 * Generate a random reportID up to 53 bits aka 9,007,199,254,740,991 (Number.MAX_SAFE_INTEGER).
 * There were approximately 98,000,000 reports with sequential IDs generated before we started using this approach, those make up roughly one billionth of the space for these numbers,
 * so we live with the 1 in a billion chance of a collision with an older ID until we can switch to 64-bit IDs.
 *
 * In a test of 500M reports (28 years of reports at our current max rate) we got 20-40 collisions meaning that
 * this is more than random enough for our needs.
 */
function generateReportID(): string {
    return (Math.floor(Math.random() * 2 ** 21) * 2 ** 32 + Math.floor(Math.random() * 2 ** 32)).toString();
}

function hasReportNameError(report: OnyxEntry<Report>): boolean {
    return !isEmptyObject(report?.errorFields?.reportName);
}

/**
 * For comments shorter than or equal to 10k chars, convert the comment from MD into HTML because that's how it is stored in the database
 * For longer comments, skip parsing, but still escape the text, and display plaintext for performance reasons. It takes over 40s to parse a 100k long string!!
 */
function getParsedComment(text: string, parsingDetails?: ParsingDetails, mediaAttributes?: Record<string, string>, disabledRules?: string[]): string {
    let isGroupPolicyReport = false;
    if (parsingDetails?.reportID) {
        const currentReport = getReportOrDraftReport(parsingDetails?.reportID);
        isGroupPolicyReport = isReportInGroupPolicy(currentReport);
    }

    if (parsingDetails?.policyID) {
        // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
        // eslint-disable-next-line deprecation/deprecation
        const policyType = getPolicy(parsingDetails?.policyID)?.type;
        if (policyType) {
            isGroupPolicyReport = isGroupPolicy(policyType);
        }
    }

    const rules = disabledRules ?? [];

    if (text.length > CONST.MAX_MARKUP_LENGTH) {
        return lodashEscape(text);
    }

    return getParsedMessageWithShortMentions({
        text,
        availableMentionLogins: allPersonalDetailLogins,
        userEmailDomain: currentUserPrivateDomain,
        parserOptions: {
            disabledRules: isGroupPolicyReport ? [...rules] : ['reportMentions', ...rules],
            extras: {mediaAttributeCache: mediaAttributes},
        },
    });
}

function getUploadingAttachmentHtml(file?: FileObject): string {
    if (!file || typeof file.uri !== 'string') {
        return '';
    }

    const dataAttributes = [
        `${CONST.ATTACHMENT_OPTIMISTIC_SOURCE_ATTRIBUTE}="${file.uri}"`,
        `${CONST.ATTACHMENT_SOURCE_ATTRIBUTE}="${file.uri}"`,
        `${CONST.ATTACHMENT_ORIGINAL_FILENAME_ATTRIBUTE}="${file.name}"`,
        'width' in file && `${CONST.ATTACHMENT_THUMBNAIL_WIDTH_ATTRIBUTE}="${file.width}"`,
        'height' in file && `${CONST.ATTACHMENT_THUMBNAIL_HEIGHT_ATTRIBUTE}="${file.height}"`,
    ]
        .filter((x) => !!x)
        .join(' ');

    // file.type is a known mime type like image/png, image/jpeg, video/mp4 etc.
    if (file.type?.startsWith('image')) {
        return `<img src="${file.uri}" alt="${file.name}" ${dataAttributes} />`;
    }
    if (file.type?.startsWith('video')) {
        return `<video src="${file.uri}" ${dataAttributes}>${file.name}</video>`;
    }

    // For all other types, we present a generic download link
    return `<a href="${file.uri}" ${dataAttributes}>${file.name}</a>`;
}

function getReportDescription(report: OnyxEntry<Report>): string {
    if (!report?.description) {
        return '';
    }
    try {
        const reportDescription = report?.description;
        const objectDescription = JSON.parse(reportDescription) as {html: string};
        return objectDescription.html ?? reportDescription ?? '';
    } catch (error) {
        return report?.description ?? '';
    }
}

function getPolicyDescriptionText(policy: OnyxEntry<Policy>): string {
    if (!policy?.description) {
        return '';
    }

    return Parser.htmlToText(policy.description);
}

/**
 * Fixme the `shouldEscapeText` arg is never used (it's always set to undefined)
 * it should be removed after https://github.com/Expensify/App/issues/50724 gets fixed as a followup
 */
function buildOptimisticAddCommentReportAction(
    text?: string,
    file?: FileObject,
    actorAccountID?: number,
    createdOffset = 0,
    shouldEscapeText?: boolean,
    reportID?: string,
    reportActionID: string = rand64(),
): OptimisticReportAction {
    const commentText = getParsedComment(text ?? '', {shouldEscapeText, reportID});
    const attachmentHtml = getUploadingAttachmentHtml(file);

    const htmlForNewComment = `${commentText}${commentText && attachmentHtml ? '<br /><br />' : ''}${attachmentHtml}`;
    const textForNewComment = Parser.htmlToText(htmlForNewComment);

    const isAttachmentOnly = file && !text;
    const isAttachmentWithText = !!text && file !== undefined;
    const accountID = actorAccountID ?? currentUserAccountID ?? CONST.DEFAULT_NUMBER_ID;
    const delegateAccountDetails = getPersonalDetailByEmail(delegateEmail);

    // Remove HTML from text when applying optimistic offline comment
    return {
        commentText,
        reportAction: {
            reportActionID,
            reportID,
            actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
            actorAccountID: accountID,
            person: [
                {
                    style: 'strong',
                    text: allPersonalDetails?.[accountID]?.displayName ?? currentUserEmail,
                    type: 'TEXT',
                },
            ],
            automatic: false,
            avatar: allPersonalDetails?.[accountID]?.avatar,
            created: DateUtils.getDBTimeWithSkew(Date.now() + createdOffset),
            message: [
                {
                    translationKey: isAttachmentOnly ? CONST.TRANSLATION_KEYS.ATTACHMENT : '',
                    type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                    html: htmlForNewComment,
                    text: textForNewComment,
                },
            ],
            originalMessage: {
                html: htmlForNewComment,
                whisperedTo: [],
            },
            isFirstItem: false,
            isAttachmentOnly,
            isAttachmentWithText,
            pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
            shouldShow: true,
            isOptimisticAction: true,
            delegateAccountID: delegateAccountDetails?.accountID,
        },
    };
}

/**
 * update optimistic parent reportAction when a comment is added or remove in the child report
 * @param parentReportAction - Parent report action of the child report
 * @param lastVisibleActionCreated - Last visible action created of the child report
 * @param type - The type of action in the child report
 */

function updateOptimisticParentReportAction(parentReportAction: OnyxEntry<ReportAction>, lastVisibleActionCreated: string, type: string): UpdateOptimisticParentReportAction {
    let childVisibleActionCount = parentReportAction?.childVisibleActionCount ?? 0;
    let childCommenterCount = parentReportAction?.childCommenterCount ?? 0;
    let childOldestFourAccountIDs = parentReportAction?.childOldestFourAccountIDs;

    if (type === CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
        childVisibleActionCount += 1;
        const oldestFourAccountIDs = childOldestFourAccountIDs ? childOldestFourAccountIDs.split(',') : [];
        if (oldestFourAccountIDs.length < 4) {
            const index = oldestFourAccountIDs.findIndex((accountID) => accountID === currentUserAccountID?.toString());
            if (index === -1) {
                childCommenterCount += 1;
                oldestFourAccountIDs.push(currentUserAccountID?.toString() ?? '');
            }
        }
        childOldestFourAccountIDs = oldestFourAccountIDs.join(',');
    } else if (type === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE) {
        if (childVisibleActionCount > 0) {
            childVisibleActionCount -= 1;
        }

        if (childVisibleActionCount === 0) {
            childCommenterCount = 0;
            childOldestFourAccountIDs = '';
        }
    }

    return {
        childVisibleActionCount,
        childCommenterCount,
        childLastVisibleActionCreated: lastVisibleActionCreated,
        childOldestFourAccountIDs,
    };
}

/**
 * Builds an optimistic reportAction for the parent report when a task is created
 * @param taskReportID - Report ID of the task
 * @param taskTitle - Title of the task
 * @param taskAssigneeAccountID - AccountID of the person assigned to the task
 * @param text - Text of the comment
 * @param parentReportID - Report ID of the parent report
 * @param createdOffset - The offset for task's created time that created via a loop
 */
function buildOptimisticTaskCommentReportAction(
    taskReportID: string,
    taskTitle: string,
    taskAssigneeAccountID: number,
    text: string,
    parentReportID: string | undefined,
    actorAccountID?: number,
    createdOffset = 0,
): OptimisticReportAction {
    const reportAction = buildOptimisticAddCommentReportAction(text, undefined, undefined, createdOffset, undefined, taskReportID);
    if (Array.isArray(reportAction.reportAction.message)) {
        const message = reportAction.reportAction.message.at(0);
        if (message) {
            message.taskReportID = taskReportID;
        }
    } else if (!Array.isArray(reportAction.reportAction.message) && reportAction.reportAction.message) {
        reportAction.reportAction.message.taskReportID = taskReportID;
    }

    // These parameters are not saved on the reportAction, but are used to display the task in the UI
    // Added when we fetch the reportActions on a report
    // eslint-disable-next-line
    reportAction.reportAction.originalMessage = {
        html: getReportActionHtml(reportAction.reportAction),
        taskReportID: getReportActionMessageReportUtils(reportAction.reportAction)?.taskReportID,
        whisperedTo: [],
    };
    reportAction.reportAction.childReportID = taskReportID;
    reportAction.reportAction.parentReportID = parentReportID;
    reportAction.reportAction.childType = CONST.REPORT.TYPE.TASK;
    reportAction.reportAction.childReportName = taskTitle;
    reportAction.reportAction.childManagerAccountID = taskAssigneeAccountID;
    reportAction.reportAction.childStatusNum = CONST.REPORT.STATUS_NUM.OPEN;
    reportAction.reportAction.childStateNum = CONST.REPORT.STATE_NUM.OPEN;

    if (actorAccountID) {
        reportAction.reportAction.actorAccountID = actorAccountID;
    }

    return reportAction;
}

function buildOptimisticSelfDMReport(created: string): Report {
    return {
        reportID: generateReportID(),
        participants: {
            [currentUserAccountID ?? CONST.DEFAULT_NUMBER_ID]: {
                notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.MUTE,
            },
        },
        type: CONST.REPORT.TYPE.CHAT,
        chatType: CONST.REPORT.CHAT_TYPE.SELF_DM,
        isOwnPolicyExpenseChat: false,
        lastActorAccountID: 0,
        lastMessageHtml: '',
        lastMessageText: undefined,
        lastReadTime: created,
        lastVisibleActionCreated: created,
        ownerAccountID: currentUserAccountID,
        reportName: '',
        stateNum: 0,
        statusNum: 0,
        writeCapability: CONST.REPORT.WRITE_CAPABILITIES.ALL,
    };
}

/**
 * Builds an optimistic IOU report with a randomly generated reportID
 *
 * @param payeeAccountID - AccountID of the person generating the IOU.
 * @param payerAccountID - AccountID of the other person participating in the IOU.
 * @param total - IOU amount in the smallest unit of the currency.
 * @param chatReportID - Report ID of the chat where the IOU is.
 * @param currency - IOU currency.
 * @param isSendingMoney - If we pay someone the IOU should be created as settled
 * @param parentReportActionID - The parent report action ID of the IOU report
 * @param optimisticIOUReportID - Optimistic IOU report id
 */

function buildOptimisticIOUReport(
    payeeAccountID: number,
    payerAccountID: number,
    total: number,
    chatReportID: string | undefined,
    currency: string,
    isSendingMoney = false,
    parentReportActionID?: string,
    optimisticIOUReportID?: string,
): OptimisticIOUReport {
    const formattedTotal = convertToDisplayString(total, currency);
    const personalDetails = getPersonalDetailsForAccountID(payerAccountID);
    const payerEmail = 'login' in personalDetails ? personalDetails.login : '';
    const policyID = chatReportID ? getReport(chatReportID, allReports)?.policyID : undefined;
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    const participants: Participants = {
        [payeeAccountID]: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN},
        [payerAccountID]: {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN},
    };

    return {
        type: CONST.REPORT.TYPE.IOU,
        chatReportID,
        currency,
        managerID: payerAccountID,
        ownerAccountID: payeeAccountID,
        participants,
        reportID: optimisticIOUReportID ?? generateReportID(),
        stateNum: isSendingMoney ? CONST.REPORT.STATE_NUM.APPROVED : CONST.REPORT.STATE_NUM.SUBMITTED,
        statusNum: isSendingMoney ? CONST.REPORT.STATUS_NUM.REIMBURSED : CONST.REPORT.STATE_NUM.SUBMITTED,
        total,
        unheldTotal: total,
        nonReimbursableTotal: 0,
        unheldNonReimbursableTotal: 0,

        // We don't translate reportName because the server response is always in English
        reportName: `${payerEmail} owes ${formattedTotal}`,
        parentReportID: chatReportID,
        lastVisibleActionCreated: DateUtils.getDBTime(),
        fieldList: policy?.fieldList,
        parentReportActionID,
    };
}

function getHumanReadableStatus(statusNum: number): string {
    const status = Object.keys(CONST.REPORT.STATUS_NUM).find((key) => CONST.REPORT.STATUS_NUM[key as keyof typeof CONST.REPORT.STATUS_NUM] === statusNum);
    return status ? `${status.charAt(0)}${status.slice(1).toLowerCase()}` : '';
}

/**
 * Populates the report field formula with the values from the report and policy.
 * Currently, this only supports optimistic expense reports.
 * Each formula field is either replaced with a value, or removed.
 * If after all replacements the formula is empty, the original formula is returned.
 * See {@link https://help.expensify.com/articles/expensify-classic/insights-and-custom-reporting/Custom-Templates}
 */
function populateOptimisticReportFormula(formula: string, report: OptimisticExpenseReport, policy: OnyxEntry<Policy>): string {
    const createdDate = report.lastVisibleActionCreated ? new Date(report.lastVisibleActionCreated) : undefined;
    const result = formula
        // We don't translate because the server response is always in English
        .replaceAll(/\{report:type\}/gi, 'Expense Report')
        .replaceAll(/\{report:startdate\}/gi, createdDate ? format(createdDate, CONST.DATE.FNS_FORMAT_STRING) : '')
        .replaceAll(/\{report:total\}/gi, report.total !== undefined ? convertToDisplayString(Math.abs(report.total), report.currency).toString() : '')
        .replaceAll(/\{report:currency\}/gi, report.currency ?? '')
        .replaceAll(/\{report:policyname\}/gi, policy?.name ?? '')
        .replaceAll(/\{report:workspacename\}/gi, policy?.name ?? '')
        .replaceAll(/\{report:created\}/gi, createdDate ? format(createdDate, CONST.DATE.FNS_DATE_TIME_FORMAT_STRING) : '')
        .replaceAll(/\{report:created:yyyy-MM-dd\}/gi, createdDate ? format(createdDate, CONST.DATE.FNS_FORMAT_STRING) : '')
        .replaceAll(/\{report:status\}/gi, report.statusNum !== undefined ? getHumanReadableStatus(report.statusNum) : '')
        .replaceAll(/\{user:email\}/gi, currentUserEmail ?? '')
        .replaceAll(/\{user:email\|frontPart\}/gi, (currentUserEmail ? currentUserEmail.split('@').at(0) : '') ?? '')
        .replaceAll(/\{report:(.+)\}/gi, '');

    return result.trim().length ? result : formula;
}

/** Builds an optimistic invoice report with a randomly generated reportID */
function buildOptimisticInvoiceReport(
    chatReportID: string,
    policyID: string | undefined,
    receiverAccountID: number,
    receiverName: string,
    total: number,
    currency: string,
): OptimisticExpenseReport {
    const formattedTotal = convertToDisplayString(total, currency);
    const invoiceReport = {
        reportID: generateReportID(),
        chatReportID,
        policyID,
        type: CONST.REPORT.TYPE.INVOICE,
        ownerAccountID: currentUserAccountID,
        managerID: receiverAccountID,
        currency,
        // We don't translate reportName because the server response is always in English
        reportName: `${receiverName} owes ${formattedTotal}`,
        stateNum: CONST.REPORT.STATE_NUM.SUBMITTED,
        statusNum: CONST.REPORT.STATUS_NUM.OPEN,
        total: total * -1,
        participants: {
            [receiverAccountID]: {
                notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN,
            },
        },
        parentReportID: chatReportID,
        lastVisibleActionCreated: DateUtils.getDBTime(),
    };

    if (currentUserAccountID) {
        invoiceReport.participants[currentUserAccountID] = {notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN};
    }

    return invoiceReport;
}

/**
 * Returns the stateNum and statusNum for an expense report based on the policy settings
 * @param policy
 */
function getExpenseReportStateAndStatus(policy: OnyxEntry<Policy>, isEmptyOptimisticReport = false) {
    const isASAPSubmitBetaEnabled = Permissions.isBetaEnabled(CONST.BETAS.ASAP_SUBMIT, allBetas);
    if (isASAPSubmitBetaEnabled) {
        return {
            stateNum: CONST.REPORT.STATE_NUM.OPEN,
            statusNum: CONST.REPORT.STATUS_NUM.OPEN,
        };
    }
    const isInstantSubmitEnabledLocal = isInstantSubmitEnabled(policy);
    const isSubmitAndCloseLocal = isSubmitAndClose(policy);
    const arePaymentsDisabled = policy?.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_NO;

    if (isInstantSubmitEnabledLocal && arePaymentsDisabled && isSubmitAndCloseLocal && !isEmptyOptimisticReport) {
        return {
            stateNum: CONST.REPORT.STATE_NUM.APPROVED,
            statusNum: CONST.REPORT.STATUS_NUM.CLOSED,
        };
    }

    if (isInstantSubmitEnabledLocal) {
        return {
            stateNum: CONST.REPORT.STATE_NUM.SUBMITTED,
            statusNum: CONST.REPORT.STATUS_NUM.SUBMITTED,
        };
    }

    return {
        stateNum: CONST.REPORT.STATE_NUM.OPEN,
        statusNum: CONST.REPORT.STATUS_NUM.OPEN,
    };
}

/**
 * Builds an optimistic Expense report with a randomly generated reportID
 *
 * @param chatReportID - Report ID of the PolicyExpenseChat where the Expense Report is
 * @param policyID - The policy ID of the PolicyExpenseChat
 * @param payeeAccountID - AccountID of the employee (payee)
 * @param total - Amount in cents
 * @param currency
 * @param reimbursable – Whether the expense is reimbursable
 * @param parentReportActionID – The parent ReportActionID of the PolicyExpenseChat
 * @param optimisticIOUReportID – Optimistic IOU report id
 */
function buildOptimisticExpenseReport(
    chatReportID: string | undefined,
    policyID: string | undefined,
    payeeAccountID: number,
    total: number,
    currency: string,
    nonReimbursableTotal = 0,
    parentReportActionID?: string,
    optimisticIOUReportID?: string,
): OptimisticExpenseReport {
    // The amount for Expense reports are stored as negative value in the database
    const storedTotal = total * -1;
    const storedNonReimbursableTotal = nonReimbursableTotal * -1;
    const report = chatReportID ? getReport(chatReportID, allReports) : undefined;
    const policyName = getPolicyName({report});
    const formattedTotal = convertToDisplayString(storedTotal, currency);
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    const {stateNum, statusNum} = getExpenseReportStateAndStatus(policy);

    const expenseReport: OptimisticExpenseReport = {
        reportID: optimisticIOUReportID ?? generateReportID(),
        chatReportID,
        policyID,
        type: CONST.REPORT.TYPE.EXPENSE,
        ownerAccountID: payeeAccountID,
        currency,
        // We don't translate reportName because the server response is always in English
        reportName: `${policyName} owes ${formattedTotal}`,
        stateNum,
        statusNum,
        total: storedTotal,
        unheldTotal: storedTotal,
        nonReimbursableTotal: storedNonReimbursableTotal,
        unheldNonReimbursableTotal: storedNonReimbursableTotal,
        participants: {
            [payeeAccountID]: {
                notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN,
            },
        },
        parentReportID: chatReportID,
        lastVisibleActionCreated: DateUtils.getDBTime(),
        parentReportActionID,
    };

    // Get the approver/manager for this report to properly display the optimistic data
    const submitToAccountID = getSubmitToAccountID(policy, expenseReport);
    if (submitToAccountID) {
        expenseReport.managerID = submitToAccountID;
    }

    const titleReportField = getTitleReportField(getReportFieldsByPolicyID(policyID) ?? {});
    if (!!titleReportField && isPaidGroupPolicyExpenseReport(expenseReport)) {
        expenseReport.reportName = populateOptimisticReportFormula(titleReportField.defaultValue, expenseReport, policy);
    }

    expenseReport.fieldList = policy?.fieldList;

    return expenseReport;
}

function buildOptimisticEmptyReport(reportID: string, accountID: number, parentReport: OnyxEntry<Report>, parentReportActionID: string, policy: OnyxEntry<Policy>, timeOfCreation: string) {
    const {stateNum, statusNum} = getExpenseReportStateAndStatus(policy, true);
    const titleReportField = getTitleReportField(getReportFieldsByPolicyID(policy?.id) ?? {});
    const optimisticEmptyReport: OptimisticNewReport = {
        reportName: '',
        reportID,
        policyID: policy?.id,
        type: CONST.REPORT.TYPE.EXPENSE,
        currency: policy?.outputCurrency,
        ownerAccountID: accountID,
        stateNum,
        statusNum,
        total: 0,
        nonReimbursableTotal: 0,
        participants: {},
        lastVisibleActionCreated: timeOfCreation,
        pendingFields: {createReport: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD},
        parentReportID: parentReport?.reportID,
        parentReportActionID,
        chatReportID: parentReport?.reportID,
        managerID: getManagerAccountID(policy, {ownerAccountID: accountID}),
    };

    const optimisticReportName = populateOptimisticReportFormula(titleReportField?.defaultValue ?? CONST.POLICY.DEFAULT_REPORT_NAME_PATTERN, optimisticEmptyReport, policy);
    optimisticEmptyReport.reportName = optimisticReportName;

    optimisticEmptyReport.participants = accountID
        ? {
              [accountID]: {
                  notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN,
              },
          }
        : {};
    optimisticEmptyReport.ownerAccountID = accountID;
    return optimisticEmptyReport;
}

function getRejectedReportMessage() {
    return translateLocal('iou.rejectedThisReport');
}

function getUpgradeWorkspaceMessage() {
    return translateLocal('workspaceActions.upgradedWorkspace');
}

function getDowngradeWorkspaceMessage() {
    return translateLocal('workspaceActions.downgradedWorkspace');
}

function getWorkspaceNameUpdatedMessage(action: ReportAction) {
    const {oldName, newName} = getOriginalMessage(action as ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.UPDATE_NAME>) ?? {};
    const message = oldName && newName ? translateLocal('workspaceActions.renamedWorkspaceNameAction', {oldName, newName}) : getReportActionText(action);
    return Str.htmlEncode(message);
}

function getDeletedTransactionMessage(action: ReportAction) {
    const deletedTransactionOriginalMessage = getOriginalMessage(action as ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.DELETED_TRANSACTION>) ?? {};
    const amount = Math.abs(deletedTransactionOriginalMessage.amount ?? 0);
    const currency = deletedTransactionOriginalMessage.currency ?? '';
    const formattedAmount = convertToDisplayString(amount, currency) ?? '';
    const message = translateLocal('iou.deletedTransaction', {
        amount: formattedAmount,
        merchant: deletedTransactionOriginalMessage.merchant ?? '',
    });
    return message;
}

function getMovedTransactionMessage(report: OnyxEntry<Report>) {
    const reportName = getReportName(report) ?? report?.reportName ?? '';
    const reportUrl = `${environmentURL}/r/${report?.reportID}`;
    const message = translateLocal('iou.movedTransaction', {
        reportUrl,
        reportName,
    });
    return message;
}

function getPolicyChangeMessage(action: ReportAction) {
    const PolicyChangeOriginalMessage = getOriginalMessage(action as ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.CHANGE_POLICY>) ?? {};
    const {fromPolicy: fromPolicyID, toPolicy: toPolicyID} = PolicyChangeOriginalMessage as OriginalMessageChangePolicy;
    const message = translateLocal('report.actions.type.changeReportPolicy', {
        fromPolicyName: fromPolicyID ? getPolicyNameByID(fromPolicyID) : undefined,
        toPolicyName: getPolicyNameByID(toPolicyID),
    });
    return message;
}

/**
 * @param iouReportID - the report ID of the IOU report the action belongs to
 * @param type - IOUReportAction type. Can be oneOf(create, decline, cancel, pay, split)
 * @param total - IOU total in cents
 * @param comment - IOU comment
 * @param currency - IOU currency
 * @param paymentType - IOU paymentMethodType. Can be oneOf(Elsewhere, Expensify)
 * @param isSettlingUp - Whether we are settling up an IOU
 */
function getIOUReportActionMessage(iouReportID: string, type: string, total: number, comment: string, currency: string, paymentType = '', isSettlingUp = false): Message[] {
    const report = getReportOrDraftReport(iouReportID);
    const amount =
        type === CONST.IOU.REPORT_ACTION_TYPE.PAY && !isEmptyObject(report)
            ? convertToDisplayString(getMoneyRequestSpendBreakdown(report).totalDisplaySpend, currency)
            : convertToDisplayString(total, currency);

    let paymentMethodMessage;
    switch (paymentType) {
        case CONST.IOU.PAYMENT_TYPE.VBBA:
        case CONST.IOU.PAYMENT_TYPE.EXPENSIFY:
            paymentMethodMessage = ' with Expensify';
            break;
        default:
            paymentMethodMessage = ` elsewhere`;
            break;
    }

    let iouMessage;
    switch (type) {
        case CONST.REPORT.ACTIONS.TYPE.APPROVED:
            iouMessage = `approved ${amount}`;
            break;
        case CONST.REPORT.ACTIONS.TYPE.FORWARDED:
            iouMessage = `approved ${amount}`;
            break;
        case CONST.REPORT.ACTIONS.TYPE.UNAPPROVED:
            iouMessage = `unapproved ${amount}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.CREATE:
            iouMessage = `submitted ${amount}${comment && ` for ${comment}`}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.TRACK:
            iouMessage = `tracking ${amount}${comment && ` for ${comment}`}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.SPLIT:
            iouMessage = `split ${amount}${comment && ` for ${comment}`}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.DELETE:
            iouMessage = `deleted the ${amount} expense${comment && ` for ${comment}`}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.PAY:
            iouMessage = isSettlingUp ? `paid ${amount}${paymentMethodMessage}` : `sent ${amount}${comment && ` for ${comment}`}${paymentMethodMessage}`;
            break;
        case CONST.REPORT.ACTIONS.TYPE.SUBMITTED:
            iouMessage = translateLocal('iou.expenseAmount', {formattedAmount: amount});
            break;
        default:
            break;
    }

    return [
        {
            html: lodashEscape(iouMessage),
            text: iouMessage ?? '',
            isEdited: false,
            type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
        },
    ];
}

/**
 * Builds an optimistic IOU reportAction object
 *
 * @param type - IOUReportAction type. Can be oneOf(create, delete, pay, split).
 * @param amount - IOU amount in cents.
 * @param currency
 * @param comment - User comment for the IOU.
 * @param participants - An array with participants details.
 * @param [transactionID] - Not required if the IOUReportAction type is 'pay'
 * @param [paymentType] - Only required if the IOUReportAction type is 'pay'. Can be oneOf(elsewhere, Expensify).
 * @param [iouReportID] - Only required if the IOUReportActions type is oneOf(decline, cancel, pay). Generates a randomID as default.
 * @param [isSettlingUp] - Whether we are settling up an IOU.
 * @param [isSendMoneyFlow] - Whether this is pay someone flow
 * @param [receipt]
 * @param [isOwnPolicyExpenseChat] - Whether this is an expense report create from the current user's policy expense chat
 */
function buildOptimisticIOUReportAction(params: BuildOptimisticIOUReportActionParams): OptimisticIOUReportAction {
    const {
        type,
        amount,
        currency,
        comment,
        participants,
        transactionID,
        paymentType,
        iouReportID = '',
        isSettlingUp = false,
        isSendMoneyFlow = false,
        isOwnPolicyExpenseChat = false,
        created = DateUtils.getDBTime(),
        linkedExpenseReportAction,
        isPersonalTrackingExpense = false,
        reportActionID,
    } = params;

    const IOUReportID = isPersonalTrackingExpense ? undefined : iouReportID || generateReportID();

    const originalMessage: ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.IOU>['originalMessage'] = {
        amount,
        comment,
        currency,
        IOUTransactionID: transactionID,
        IOUReportID,
        type,
    };

    const delegateAccountDetails = getPersonalDetailByEmail(delegateEmail);

    if (type === CONST.IOU.REPORT_ACTION_TYPE.PAY) {
        // In pay someone flow, we store amount, comment, currency in IOUDetails when type = pay
        if (isSendMoneyFlow) {
            const keys = ['amount', 'comment', 'currency'] as const;
            keys.forEach((key) => {
                delete originalMessage[key];
            });
            originalMessage.IOUDetails = {amount, comment, currency};
            originalMessage.paymentType = paymentType;
        } else {
            // In case of pay someone action, we dont store the comment
            // and there is no single transactionID to link the action to.
            delete originalMessage.IOUTransactionID;
            delete originalMessage.comment;
            originalMessage.paymentType = paymentType;
        }
    }

    // IOUs of type split only exist in group DMs and those don't have an iouReport so we need to delete the IOUReportID key
    if (type === CONST.IOU.REPORT_ACTION_TYPE.SPLIT) {
        delete originalMessage.IOUReportID;
    }

    if (type !== CONST.IOU.REPORT_ACTION_TYPE.PAY) {
        // Split expense made from a policy expense chat only have the payee's accountID as the participant because the payer could be any policy admin
        if (isOwnPolicyExpenseChat && type === CONST.IOU.REPORT_ACTION_TYPE.SPLIT) {
            originalMessage.participantAccountIDs = currentUserAccountID ? [currentUserAccountID] : [];
        } else {
            originalMessage.participantAccountIDs = currentUserAccountID
                ? [
                      currentUserAccountID,
                      ...participants.filter((participant) => participant.accountID !== currentUserAccountID).map((participant) => participant.accountID ?? CONST.DEFAULT_NUMBER_ID),
                  ]
                : participants.map((participant) => participant.accountID ?? CONST.DEFAULT_NUMBER_ID);
        }
    }

    const iouReportAction = {
        ...linkedExpenseReportAction,
        actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
        actorAccountID: currentUserAccountID,
        automatic: false,
        isAttachmentOnly: false,
        originalMessage,
        reportActionID: reportActionID ?? rand64(),
        shouldShow: true,
        created,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        delegateAccountID: delegateAccountDetails?.accountID,
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        avatar: getCurrentUserAvatar(),
        message: getIOUReportActionMessage(iouReportID, type, amount, comment, currency, paymentType, isSettlingUp),
    };

    const managerMcTestParticipant = participants.find((participant) => isSelectedManagerMcTest(participant.login));
    if (managerMcTestParticipant) {
        return {
            ...iouReportAction,
            actorAccountID: managerMcTestParticipant.accountID,
            avatar: managerMcTestParticipant.icons?.[0]?.source,
            person: [
                {
                    style: 'strong',
                    text: getDisplayNameForParticipant(managerMcTestParticipant),
                    type: 'TEXT',
                },
            ],
        };
    }

    return iouReportAction;
}

/**
 * Builds an optimistic APPROVED report action with a randomly generated reportActionID.
 */
function buildOptimisticApprovedReportAction(amount: number, currency: string, expenseReportID: string): OptimisticApprovedReportAction {
    const originalMessage = {
        amount,
        currency,
        expenseReportID,
    };
    const delegateAccountDetails = getPersonalDetailByEmail(delegateEmail);

    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.APPROVED,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        isAttachmentOnly: false,
        originalMessage,
        message: getIOUReportActionMessage(expenseReportID, CONST.REPORT.ACTIONS.TYPE.APPROVED, Math.abs(amount), '', currency),
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        delegateAccountID: delegateAccountDetails?.accountID,
    };
}

/**
 * Builds an optimistic APPROVED report action with a randomly generated reportActionID.
 */
function buildOptimisticUnapprovedReportAction(amount: number, currency: string, expenseReportID: string): OptimisticUnapprovedReportAction {
    const delegateAccountDetails = getPersonalDetailByEmail(delegateEmail);
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.UNAPPROVED,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        isAttachmentOnly: false,
        originalMessage: {
            amount,
            currency,
            expenseReportID,
        },
        message: getIOUReportActionMessage(expenseReportID, CONST.REPORT.ACTIONS.TYPE.UNAPPROVED, Math.abs(amount), '', currency),
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        delegateAccountID: delegateAccountDetails?.accountID,
    };
}

/**
 * Builds an optimistic MOVED report action with a randomly generated reportActionID.
 * This action is used when we move reports across workspaces.
 */
function buildOptimisticMovedReportAction(
    fromPolicyID: string | undefined,
    toPolicyID: string,
    newParentReportID: string,
    movedReportID: string,
    policyName: string,
    isIouReport = false,
): ReportAction {
    const originalMessage = {
        fromPolicyID,
        toPolicyID,
        newParentReportID,
        movedReportID,
    };

    const movedActionMessage = [
        {
            html: isIouReport
                ? `moved this <a href='${CONST.NEW_EXPENSIFY_URL}r/${movedReportID}' target='_blank' rel='noreferrer noopener'>report</a> to the <a href='${CONST.NEW_EXPENSIFY_URL}r/${newParentReportID}' target='_blank' rel='noreferrer noopener'>${policyName}</a> workspace`
                : `moved this report to the <a href='${CONST.NEW_EXPENSIFY_URL}r/${newParentReportID}' target='_blank' rel='noreferrer noopener'>${policyName}</a> workspace`,
            text: `moved this report to the ${policyName} workspace`,
            type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
        },
    ];

    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.MOVED,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        isAttachmentOnly: false,
        originalMessage,
        message: movedActionMessage,
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Builds an optimistic CHANGE_POLICY report action with a randomly generated reportActionID.
 * This action is used when we change the workspace of a report.
 */
function buildOptimisticChangePolicyReportAction(fromPolicyID: string | undefined, toPolicyID: string, automaticAction = false): ReportAction {
    const originalMessage = {
        fromPolicy: fromPolicyID,
        toPolicy: toPolicyID,
        automaticAction,
    };

    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const fromPolicy = getPolicy(fromPolicyID);
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const toPolicy = getPolicy(toPolicyID);

    const changePolicyReportActionMessage = [
        {
            type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            text: `changed the workspace to ${toPolicy?.name}`,
        },
        ...(fromPolicyID
            ? [
                  {
                      type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                      text: ` (previously ${fromPolicy?.name})`,
                  },
              ]
            : []),
    ];

    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.CHANGE_POLICY,
        actorAccountID: currentUserAccountID,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        originalMessage,
        message: changePolicyReportActionMessage,
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: rand64(),
        shouldShow: true,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

function buildOptimisticTransactionAction(
    type: typeof CONST.REPORT.ACTIONS.TYPE.MOVED_TRANSACTION | typeof CONST.REPORT.ACTIONS.TYPE.UNREPORTED_TRANSACTION,
    transactionThreadReportID: string | undefined,
    targetReportID: string,
): ReportAction {
    const reportName = allReports?.[targetReportID]?.reportName ?? '';
    const url = `${environmentURL}/r/${targetReportID}`;
    const [actionText, messageHtml] =
        type === CONST.REPORT.ACTIONS.TYPE.MOVED_TRANSACTION
            ? [`moved this expense to ${reportName}`, `moved this expense to <a href='${url}' target='_blank' rel='noreferrer noopener'>${reportName}</a>`]
            : ['moved this expense to your personal space', 'moved this expense to your personal space'];

    return {
        actionName: type,
        reportID: transactionThreadReportID,
        actorAccountID: currentUserAccountID,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        originalMessage: type === CONST.REPORT.ACTIONS.TYPE.MOVED_TRANSACTION ? {toReportID: targetReportID} : {fromReportID: targetReportID},
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                html: messageHtml,
                text: actionText,
            },
        ],
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: rand64(),
        shouldShow: true,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Builds an optimistic MOVED_TRANSACTION report action with a randomly generated reportActionID.
 * This action is used when we change the workspace of a report.
 */
function buildOptimisticMovedTransactionAction(transactionThreadReportID: string | undefined, toReportID: string) {
    return buildOptimisticTransactionAction(CONST.REPORT.ACTIONS.TYPE.MOVED_TRANSACTION, transactionThreadReportID, toReportID);
}

/**
 * Builds an optimistic UNREPORTED_TRANSACTION report action with a randomly generated reportActionID.
 * This action is used when we un-report a transaction.
 */
function buildOptimisticUnreportedTransactionAction(transactionThreadReportID: string | undefined, fromReportID: string) {
    return buildOptimisticTransactionAction(CONST.REPORT.ACTIONS.TYPE.UNREPORTED_TRANSACTION, transactionThreadReportID, fromReportID);
}

/**
 * Builds an optimistic SUBMITTED report action with a randomly generated reportActionID.
 *
 */
function buildOptimisticSubmittedReportAction(amount: number, currency: string, expenseReportID: string, adminAccountID: number | undefined): OptimisticSubmittedReportAction {
    const originalMessage = {
        amount,
        currency,
        expenseReportID,
    };

    const delegateAccountDetails = getPersonalDetailByEmail(delegateEmail);

    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.SUBMITTED,
        actorAccountID: currentUserAccountID,
        adminAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        isAttachmentOnly: false,
        originalMessage,
        message: getIOUReportActionMessage(expenseReportID, CONST.REPORT.ACTIONS.TYPE.SUBMITTED, Math.abs(amount), '', currency),
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        delegateAccountID: delegateAccountDetails?.accountID,
    };
}

/**
 * Builds an optimistic report preview action with a randomly generated reportActionID.
 *
 * @param chatReport
 * @param iouReport
 * @param [comment] - User comment for the IOU.
 * @param [transaction] - optimistic first transaction of preview
 * @param reportActionID
 */
function buildOptimisticReportPreview(
    chatReport: OnyxInputOrEntry<Report>,
    iouReport: Report,
    comment = '',
    transaction: OnyxInputOrEntry<Transaction> = null,
    childReportID?: string,
    reportActionID?: string,
): ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW> {
    const hasReceipt = hasReceiptTransactionUtils(transaction);
    const message = getReportPreviewMessage(iouReport);
    const created = DateUtils.getDBTime();
    const reportActorAccountID = (isInvoiceReport(iouReport) || isExpenseReport(iouReport) ? iouReport?.ownerAccountID : iouReport?.managerID) ?? -1;
    const delegateAccountDetails = getPersonalDetailByEmail(delegateEmail);
    const isTestTransaction = isTestTransactionReport(iouReport);
    const isTestDriveTransaction = !!transaction?.receipt?.isTestDriveReceipt;
    const isScanRequest = transaction ? isScanRequestTransactionUtils(transaction) : false;
    return {
        reportActionID: reportActionID ?? rand64(),
        reportID: chatReport?.reportID,
        actionName: CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        originalMessage: {
            linkedReportID: iouReport?.reportID,
        },
        message: [
            {
                html: message,
                text: message,
                isEdited: false,
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
            },
        ],
        delegateAccountID: delegateAccountDetails?.accountID,
        created,
        accountID: iouReport?.managerID,
        // The preview is initially whispered if created with a receipt, so the actor is the current user as well
        actorAccountID: hasReceipt ? currentUserAccountID : reportActorAccountID,
        childReportID: childReportID ?? iouReport?.reportID,
        childMoneyRequestCount: 1,
        childLastActorAccountID: currentUserAccountID,
        childLastMoneyRequestComment: comment,
        childRecentReceiptTransactionIDs: hasReceipt && !isEmptyObject(transaction) && transaction?.transactionID ? {[transaction.transactionID]: created} : undefined,
        ...((isTestDriveTransaction || isTestTransaction) && !isScanRequest && {childStateNum: 2, childStatusNum: 4}),
    };
}

/**
 * Builds an optimistic ACTIONABLE_TRACK_EXPENSE_WHISPER action with a randomly generated reportActionID.
 */
function buildOptimisticActionableTrackExpenseWhisper(iouAction: OptimisticIOUReportAction, transactionID: string): ReportAction {
    const currentTime = DateUtils.getDBTime();
    const targetEmail = CONST.EMAIL.CONCIERGE;
    const actorAccountID = getAccountIDsByLogins([targetEmail]).at(0);
    const reportActionID = rand64();
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.ACTIONABLE_TRACK_EXPENSE_WHISPER,
        actorAccountID,
        avatar: getDefaultAvatarURL(actorAccountID),
        created: DateUtils.addMillisecondsFromDateTime(currentTime, 1),
        lastModified: DateUtils.addMillisecondsFromDateTime(currentTime, 1),
        message: [
            {
                html: CONST.ACTIONABLE_TRACK_EXPENSE_WHISPER_MESSAGE,
                text: CONST.ACTIONABLE_TRACK_EXPENSE_WHISPER_MESSAGE,
                whisperedTo: [],
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
            },
        ],
        originalMessage: {
            lastModified: DateUtils.addMillisecondsFromDateTime(currentTime, 1),
            transactionID,
        },
        person: [
            {
                text: CONST.DISPLAY_NAME.EXPENSIFY_CONCIERGE,
                type: 'TEXT',
            },
        ],
        reportActionID,
        shouldShow: true,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Builds an optimistic modified expense action with a randomly generated reportActionID.
 */
function buildOptimisticModifiedExpenseReportAction(
    transactionThread: OnyxInputOrEntry<Report>,
    oldTransaction: OnyxInputOrEntry<Transaction>,
    transactionChanges: TransactionChanges,
    isFromExpenseReport: boolean,
    policy: OnyxInputOrEntry<Policy>,
    updatedTransaction?: OnyxInputOrEntry<Transaction>,
): OptimisticModifiedExpenseReportAction {
    const originalMessage = getModifiedExpenseOriginalMessage(oldTransaction, transactionChanges, isFromExpenseReport, policy, updatedTransaction);
    const delegateAccountDetails = getPersonalDetailByEmail(delegateEmail);

    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.MODIFIED_EXPENSE,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        isAttachmentOnly: false,
        message: [
            {
                // Currently we are composing the message from the originalMessage and message is only used in OldDot and not in the App
                text: 'You',
                style: 'strong',
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
        ],
        originalMessage,
        person: [
            {
                style: 'strong',
                text: currentUserPersonalDetails?.displayName ?? String(currentUserAccountID),
                type: 'TEXT',
            },
        ],
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        reportActionID: rand64(),
        reportID: transactionThread?.reportID,
        shouldShow: true,
        delegateAccountID: delegateAccountDetails?.accountID,
    };
}

/**
 * Builds an optimistic DETACH_RECEIPT report action with a randomly generated reportActionID.
 */
function buildOptimisticDetachReceipt(reportID: string | undefined, transactionID: string, merchant: string = CONST.TRANSACTION.PARTIAL_TRANSACTION_MERCHANT) {
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.MANAGER_DETACH_RECEIPT,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        isAttachmentOnly: false,
        originalMessage: {
            transactionID,
            merchant: `${merchant}`,
        },
        message: [
            {
                type: 'COMMENT',
                html: `detached a receipt from expense '${merchant}'`,
                text: `detached a receipt from expense '${merchant}'`,
                whisperedTo: [],
            },
        ],
        person: [
            {
                style: 'strong',
                text: currentUserPersonalDetails?.displayName ?? String(currentUserAccountID),
                type: 'TEXT',
            },
        ],
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        reportActionID: rand64(),
        reportID,
        shouldShow: true,
    };
}

/**
 * Updates a report preview action that exists for an IOU report.
 *
 * @param [comment] - User comment for the IOU.
 * @param [transaction] - optimistic newest transaction of a report preview
 *
 */
function updateReportPreview(
    iouReport: OnyxEntry<Report>,
    reportPreviewAction: ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW>,
    isPayRequest = false,
    comment = '',
    transaction?: OnyxEntry<Transaction>,
): ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW> {
    const hasReceipt = hasReceiptTransactionUtils(transaction);
    const recentReceiptTransactions = reportPreviewAction?.childRecentReceiptTransactionIDs ?? {};
    const transactionsToKeep = getRecentTransactions(recentReceiptTransactions);
    const previousTransactionsArray = Object.entries(recentReceiptTransactions ?? {}).map(([key, value]) => (transactionsToKeep.includes(key) ? {[key]: value} : null));
    const previousTransactions: Record<string, string> = {};

    for (const obj of previousTransactionsArray) {
        for (const key in obj) {
            if (obj) {
                previousTransactions[key] = obj[key];
            }
        }
    }

    const message = getReportPreviewMessage(iouReport, reportPreviewAction);
    const originalMessage = getOriginalMessage(reportPreviewAction);
    return {
        ...reportPreviewAction,
        message: [
            {
                html: message,
                text: message,
                isEdited: false,
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
            },
        ],
        childLastMoneyRequestComment: comment || reportPreviewAction?.childLastMoneyRequestComment,
        childMoneyRequestCount: (reportPreviewAction?.childMoneyRequestCount ?? 0) + (isPayRequest ? 0 : 1),
        childRecentReceiptTransactionIDs: hasReceipt
            ? {
                  ...(transaction && {[transaction.transactionID]: transaction?.created}),
                  ...previousTransactions,
              }
            : recentReceiptTransactions,
        // As soon as we add a transaction without a receipt to the report, it will have ready expenses,
        // so we remove the whisper
        originalMessage: originalMessage
            ? {
                  ...originalMessage,
                  whisperedTo: hasReceipt ? originalMessage.whisperedTo : [],
                  linkedReportID: originalMessage.linkedReportID,
              }
            : undefined,
    };
}

function buildOptimisticTaskReportAction(
    taskReportID: string,
    actionName: typeof CONST.REPORT.ACTIONS.TYPE.TASK_COMPLETED | typeof CONST.REPORT.ACTIONS.TYPE.TASK_REOPENED | typeof CONST.REPORT.ACTIONS.TYPE.TASK_CANCELLED,
    message = '',
    actorAccountID = currentUserAccountID,
    createdOffset = 0,
): OptimisticTaskReportAction {
    const originalMessage = {
        taskReportID,
        type: actionName,
        text: message,
        html: message,
        whisperedTo: [],
    };
    const delegateAccountDetails = getPersonalDetailByEmail(delegateEmail);

    return {
        actionName,
        actorAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        isAttachmentOnly: false,
        originalMessage,
        message: [
            {
                text: message,
                taskReportID,
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
        ],
        person: [
            {
                style: 'strong',
                text: currentUserPersonalDetails?.displayName ?? String(currentUserAccountID),
                type: 'TEXT',
            },
        ],
        reportActionID: rand64(),
        shouldShow: true,
        created: DateUtils.getDBTimeWithSkew(Date.now() + createdOffset),
        isFirstItem: false,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        delegateAccountID: delegateAccountDetails?.accountID,
    };
}

function isWorkspaceChat(chatType: string) {
    return chatType === CONST.REPORT.CHAT_TYPE.POLICY_ADMINS || chatType === CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE || chatType === CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT;
}

/**
 * Builds an optimistic chat report with a randomly generated reportID and as much information as we currently have
 */
type BuildOptimisticChatReportParams = {
    participantList: number[];
    reportName?: string;
    chatType?: ValueOf<typeof CONST.REPORT.CHAT_TYPE>;
    policyID?: string;
    ownerAccountID?: number;
    isOwnPolicyExpenseChat?: boolean;
    oldPolicyName?: string;
    visibility?: ValueOf<typeof CONST.REPORT.VISIBILITY>;
    writeCapability?: ValueOf<typeof CONST.REPORT.WRITE_CAPABILITIES>;
    notificationPreference?: NotificationPreference;
    parentReportActionID?: string;
    parentReportID?: string;
    description?: string;
    avatarUrl?: string;
    optimisticReportID?: string;
};

function buildOptimisticChatReport({
    participantList,
    reportName = CONST.REPORT.DEFAULT_REPORT_NAME,
    chatType,
    policyID = CONST.POLICY.OWNER_EMAIL_FAKE,
    ownerAccountID = CONST.REPORT.OWNER_ACCOUNT_ID_FAKE,
    isOwnPolicyExpenseChat = false,
    oldPolicyName = '',
    visibility,
    writeCapability,
    notificationPreference = CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS,
    parentReportActionID = '',
    parentReportID = undefined,
    description = '',
    avatarUrl = '',
    optimisticReportID = '',
}: BuildOptimisticChatReportParams): OptimisticChatReport {
    const isWorkspaceChatType = chatType && isWorkspaceChat(chatType);
    const participants = participantList.reduce((reportParticipants: Participants, accountID: number) => {
        const participant: ReportParticipant = {
            notificationPreference,
            ...(!isWorkspaceChatType && {role: accountID === currentUserAccountID ? CONST.REPORT.ROLE.ADMIN : CONST.REPORT.ROLE.MEMBER}),
        };
        // eslint-disable-next-line no-param-reassign
        reportParticipants[accountID] = participant;
        return reportParticipants;
    }, {} as Participants);
    const currentTime = DateUtils.getDBTime();
    const optimisticChatReport: OptimisticChatReport = {
        type: CONST.REPORT.TYPE.CHAT,
        chatType,
        isOwnPolicyExpenseChat,
        isPinned: false,
        lastActorAccountID: 0,
        lastMessageHtml: '',
        lastMessageText: undefined,
        lastReadTime: currentTime,
        lastVisibleActionCreated: currentTime,
        oldPolicyName,
        ownerAccountID: ownerAccountID || CONST.REPORT.OWNER_ACCOUNT_ID_FAKE,
        parentReportActionID,
        parentReportID,
        participants,
        policyID,
        reportID: optimisticReportID || generateReportID(),
        reportName,
        stateNum: 0,
        statusNum: 0,
        visibility,
        description,
        writeCapability,
        avatarUrl,
    };

    if (chatType === CONST.REPORT.CHAT_TYPE.INVOICE) {
        // TODO: update to support workspace as an invoice receiver when workspace-to-workspace invoice room implemented
        optimisticChatReport.invoiceReceiver = {
            type: 'individual',
            accountID: participantList.at(0) ?? -1,
        };
    }

    return optimisticChatReport;
}

function buildOptimisticGroupChatReport(
    participantAccountIDs: number[],
    reportName: string,
    avatarUri: string,
    optimisticReportID?: string,
    notificationPreference?: NotificationPreference,
) {
    return buildOptimisticChatReport({
        participantList: participantAccountIDs,
        reportName,
        chatType: CONST.REPORT.CHAT_TYPE.GROUP,
        notificationPreference,
        avatarUrl: avatarUri,
        optimisticReportID,
    });
}

/**
 * Returns the necessary reportAction onyx data to indicate that the chat has been created optimistically
 * @param [created] - Action created time
 */
function buildOptimisticCreatedReportAction(emailCreatingAction: string, created = DateUtils.getDBTime(), optimisticReportActionID?: string): OptimisticCreatedReportAction {
    return {
        reportActionID: optimisticReportActionID ?? rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.CREATED,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: emailCreatingAction,
            },
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: ' created this report',
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created,
        shouldShow: true,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that the room has been renamed
 */
function buildOptimisticRenamedRoomReportAction(newName: string, oldName: string): OptimisticRenamedReportAction {
    const now = DateUtils.getDBTime();
    return {
        reportActionID: rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.RENAMED,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: 'You',
            },
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: ` renamed this report. New title is '${newName}' (previously '${oldName}').`,
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        originalMessage: {
            oldName,
            newName,
            html: `Room renamed to ${newName}`,
            lastModified: now,
        },
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: now,
        shouldShow: true,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that the room description has been updated
 */
function buildOptimisticRoomDescriptionUpdatedReportAction(description: string): OptimisticRoomDescriptionUpdatedReportAction {
    const now = DateUtils.getDBTime();
    return {
        reportActionID: rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.ROOM_CHANGE_LOG.UPDATE_ROOM_DESCRIPTION,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                text: description ? `set the room description to: ${Parser.htmlToText(description)}` : 'cleared the room description',
                html: description ? `<muted-text>set the room description to: ${description}</muted-text>` : '<muted-text>cleared the room description</muted-text>',
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        originalMessage: {
            description,
            lastModified: now,
        },
        created: now,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that the transaction has been put on hold optimistically
 * @param [created] - Action created time
 */
function buildOptimisticHoldReportAction(created = DateUtils.getDBTime()): OptimisticHoldReportAction {
    return {
        reportActionID: rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.HOLD,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: translateLocal('iou.heldExpense'),
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created,
        shouldShow: true,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that the transaction has been put on hold optimistically
 * @param [created] - Action created time
 */
function buildOptimisticHoldReportActionComment(comment: string, created = DateUtils.getDBTime()): OptimisticHoldReportAction {
    return {
        reportActionID: rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                text: comment,
                html: comment, // as discussed on https://github.com/Expensify/App/pull/39452 we will not support HTML for now
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created,
        shouldShow: true,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that the transaction has been removed from hold optimistically
 * @param [created] - Action created time
 */
function buildOptimisticUnHoldReportAction(created = DateUtils.getDBTime()): OptimisticHoldReportAction {
    return {
        reportActionID: rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.UNHOLD,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: translateLocal('iou.unheldExpense'),
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created,
        shouldShow: true,
    };
}

function buildOptimisticRetractedReportAction(created = DateUtils.getDBTime()): OptimisticRetractedReportAction {
    return {
        reportActionID: rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.RETRACTED,
        actorAccountID: currentUserAccountID,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                text: 'retracted',
                html: `<muted-text>retracted</muted-text>`,
            },
        ],
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created,
        shouldShow: true,
    };
}

function buildOptimisticReopenedReportAction(created = DateUtils.getDBTime()): OptimisticReopenedReportAction {
    return {
        reportActionID: rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.REOPENED,
        actorAccountID: currentUserAccountID,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                text: 'reopened',
                html: '<muted-text>reopened</muted-text>',
            },
        ],
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created,
        shouldShow: true,
    };
}

function buildOptimisticEditedTaskFieldReportAction({title, description}: Task): OptimisticEditedTaskReportAction {
    // We do not modify title & description in one request, so we need to create a different optimistic action for each field modification
    let field = '';
    let value = '';
    if (title !== undefined) {
        field = 'task title';
        value = title;
    } else if (description !== undefined) {
        field = 'description';
        value = description;
    }

    let changelog = 'edited this task';
    if (field && value) {
        changelog = `updated the ${field} to ${value}`;
    } else if (field) {
        changelog = `removed the ${field}`;
    }
    const delegateAccountDetails = getPersonalDetailByEmail(delegateEmail);

    return {
        reportActionID: rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.TASK_EDITED,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                text: changelog,
                html: getParsedComment(changelog, undefined, undefined, title !== undefined ? [...CONST.TASK_TITLE_DISABLED_RULES] : undefined),
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        shouldShow: false,
        delegateAccountID: delegateAccountDetails?.accountID,
    };
}

function buildOptimisticCardAssignedReportAction(assigneeAccountID: number): OptimisticCardAssignedReportAction {
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.CARD_ASSIGNED,
        actorAccountID: currentUserAccountID,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        originalMessage: {assigneeAccountID, cardID: -1},
        message: [{type: CONST.REPORT.MESSAGE.TYPE.COMMENT, text: '', html: ''}],
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        reportActionID: rand64(),
        shouldShow: true,
    };
}

function buildOptimisticChangedTaskAssigneeReportAction(assigneeAccountID: number): OptimisticEditedTaskReportAction {
    const delegateAccountDetails = getPersonalDetailByEmail(delegateEmail);

    return {
        reportActionID: rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.TASK_EDITED,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                text: `assigned to ${getDisplayNameForParticipant({accountID: assigneeAccountID})}`,
                html: `assigned to <mention-user accountID="${assigneeAccountID}"/>`,
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        shouldShow: false,
        delegateAccountID: delegateAccountDetails?.accountID,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that a chat has been archived
 *
 * @param reason - A reason why the chat has been archived
 */
function buildOptimisticClosedReportAction(
    emailClosingReport: string,
    policyName: string,
    reason: ValueOf<typeof CONST.REPORT.ARCHIVE_REASON> = CONST.REPORT.ARCHIVE_REASON.DEFAULT,
): OptimisticClosedReportAction {
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.CLOSED,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: emailClosingReport,
            },
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: ' closed this report',
            },
        ],
        originalMessage: {
            policyName,
            reason,
        },
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        reportActionID: rand64(),
        shouldShow: true,
    };
}

/**
 * Returns an optimistic Dismissed Violation Report Action. Use the originalMessage customize this to the type of
 * violation being dismissed.
 */
function buildOptimisticDismissedViolationReportAction(
    originalMessage: ReportAction<typeof CONST.REPORT.ACTIONS.TYPE.DISMISSED_VIOLATION>['originalMessage'],
): OptimisticDismissedViolationReportAction {
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.DISMISSED_VIOLATION,
        actorAccountID: currentUserAccountID,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: getDismissedViolationMessageText(originalMessage),
            },
        ],
        originalMessage,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        reportActionID: rand64(),
        shouldShow: true,
    };
}

function buildOptimisticResolvedDuplicatesReportAction(): OptimisticDismissedViolationReportAction {
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.RESOLVED_DUPLICATES,
        actorAccountID: currentUserAccountID,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: translateLocal('violations.resolvedDuplicates'),
            },
        ],
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        reportActionID: rand64(),
        shouldShow: true,
    };
}

function buildOptimisticAnnounceChat(policyID: string, accountIDs: number[]): OptimisticAnnounceChat {
    const announceReport = getRoom(CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE, policyID);
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const announceRoomOnyxData: AnnounceRoomOnyxData = {
        onyxOptimisticData: [],
        onyxSuccessData: [],
        onyxFailureData: [],
    };

    // Do not create #announce room if the room already exists or if there are less than 3 participants in workspace
    if (accountIDs.length < 3 || announceReport) {
        return {
            announceChatReportID: '',
            announceChatReportActionID: '',
            announceChatData: announceRoomOnyxData,
        };
    }

    const announceChatData = buildOptimisticChatReport({
        participantList: accountIDs,
        reportName: CONST.REPORT.WORKSPACE_CHAT_ROOMS.ANNOUNCE,
        chatType: CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE,
        policyID,
        ownerAccountID: CONST.POLICY.OWNER_ACCOUNT_ID_FAKE,
        oldPolicyName: policy?.name,
        writeCapability: CONST.REPORT.WRITE_CAPABILITIES.ADMINS,
        notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS,
    });

    const announceCreatedAction = buildOptimisticCreatedReportAction(CONST.POLICY.OWNER_EMAIL_FAKE);
    announceRoomOnyxData.onyxOptimisticData.push(
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT}${announceChatData.reportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                },
                ...announceChatData,
            },
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_DRAFT}${announceChatData.reportID}`,
            value: null,
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${announceChatData.reportID}`,
            value: {
                [announceCreatedAction.reportActionID]: announceCreatedAction,
            },
        },
    );
    announceRoomOnyxData.onyxSuccessData.push(
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${announceChatData.reportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: null,
                },
                pendingAction: null,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${announceChatData.reportID}`,
            value: {
                isOptimisticReport: false,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${announceChatData.reportID}`,
            value: {
                [announceCreatedAction.reportActionID]: {
                    pendingAction: null,
                },
            },
        },
    );
    announceRoomOnyxData.onyxFailureData.push(
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${announceChatData.reportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: null,
                },
                pendingAction: null,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${announceChatData.reportID}`,
            value: {
                isOptimisticReport: false,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${announceChatData.reportID}`,
            value: {
                [announceCreatedAction.reportActionID]: {
                    pendingAction: null,
                },
            },
        },
    );
    return {
        announceChatReportID: announceChatData.reportID,
        announceChatReportActionID: announceCreatedAction.reportActionID,
        announceChatData: announceRoomOnyxData,
    };
}

function buildOptimisticWorkspaceChats(policyID: string, policyName: string, expenseReportId?: string): OptimisticWorkspaceChats {
    const pendingChatMembers = getPendingChatMembers(currentUserAccountID ? [currentUserAccountID] : [], [], CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD);
    const adminsChatData = {
        ...buildOptimisticChatReport({
            participantList: currentUserAccountID ? [currentUserAccountID] : [],
            reportName: CONST.REPORT.WORKSPACE_CHAT_ROOMS.ADMINS,
            chatType: CONST.REPORT.CHAT_TYPE.POLICY_ADMINS,
            policyID,
            ownerAccountID: CONST.POLICY.OWNER_ACCOUNT_ID_FAKE,
            oldPolicyName: policyName,
        }),
    };
    const adminsChatReportID = adminsChatData.reportID;
    const adminsCreatedAction = buildOptimisticCreatedReportAction(CONST.POLICY.OWNER_EMAIL_FAKE);
    const adminsReportActionData = {
        [adminsCreatedAction.reportActionID]: adminsCreatedAction,
    };

    const expenseChatData = buildOptimisticChatReport({
        participantList: currentUserAccountID ? [currentUserAccountID] : [],
        reportName: '',
        chatType: CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT,
        policyID,
        ownerAccountID: currentUserAccountID,
        isOwnPolicyExpenseChat: true,
        oldPolicyName: policyName,
        optimisticReportID: expenseReportId,
    });

    const expenseChatReportID = expenseChatData.reportID;
    const expenseReportCreatedAction = buildOptimisticCreatedReportAction(currentUserEmail ?? '');
    const expenseReportActionData = {
        [expenseReportCreatedAction.reportActionID]: expenseReportCreatedAction,
    };

    return {
        adminsChatReportID,
        adminsChatData,
        adminsReportActionData,
        adminsCreatedReportActionID: adminsCreatedAction.reportActionID,
        expenseChatReportID,
        expenseChatData,
        expenseReportActionData,
        expenseCreatedReportActionID: expenseReportCreatedAction.reportActionID,
        pendingChatMembers,
    };
}

/**
 * Builds an optimistic Task Report with a randomly generated reportID
 *
 * @param ownerAccountID - Account ID of the person generating the Task.
 * @param assigneeAccountID - AccountID of the other person participating in the Task.
 * @param parentReportID - Report ID of the chat where the Task is.
 * @param title - Task title.
 * @param description - Task description.
 * @param policyID - PolicyID of the parent report
 */

function buildOptimisticTaskReport(
    ownerAccountID: number,
    parentReportID: string,
    assigneeAccountID = 0,
    title?: string,
    description?: string,
    policyID: string = CONST.POLICY.OWNER_EMAIL_FAKE,
    notificationPreference: NotificationPreference = CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN,
    mediaAttributes?: Record<string, string>,
): OptimisticTaskReport {
    const participants: Participants = {
        [ownerAccountID]: {
            notificationPreference,
        },
    };

    if (assigneeAccountID) {
        participants[assigneeAccountID] = {notificationPreference};
    }

    return {
        reportID: generateReportID(),
        reportName: getParsedComment(title ?? '', undefined, undefined, [...CONST.TASK_TITLE_DISABLED_RULES]),
        description: getParsedComment(description ?? '', {}, mediaAttributes),
        ownerAccountID,
        participants,
        managerID: assigneeAccountID,
        type: CONST.REPORT.TYPE.TASK,
        parentReportID,
        policyID,
        stateNum: CONST.REPORT.STATE_NUM.OPEN,
        statusNum: CONST.REPORT.STATUS_NUM.OPEN,
        lastVisibleActionCreated: DateUtils.getDBTime(),
        hasParentAccess: true,
    };
}

/**
 * Builds an optimistic EXPORTED_TO_INTEGRATION report action
 *
 * @param integration - The connectionName of the integration
 * @param markedManually - Whether the integration was marked as manually exported
 */
function buildOptimisticExportIntegrationAction(integration: ConnectionName, markedManually = false): OptimisticExportIntegrationAction {
    const label = CONST.POLICY.CONNECTIONS.NAME_USER_FRIENDLY[integration];
    return {
        reportActionID: rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.EXPORTED_TO_INTEGRATION,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        shouldShow: true,
        originalMessage: {
            label,
            lastModified: DateUtils.getDBTime(),
            markedManually,
            inProgress: true,
        },
    };
}

/**
 * A helper method to create transaction thread
 *
 * @param reportAction - the parent IOU report action from which to create the thread
 * @param moneyRequestReport - the report which the report action belongs to
 */
function buildTransactionThread(
    reportAction: OnyxEntry<ReportAction | OptimisticIOUReportAction>,
    moneyRequestReport: OnyxEntry<Report>,
    existingTransactionThreadReportID?: string,
): OptimisticChatReport {
    const participantAccountIDs = [...new Set([currentUserAccountID, Number(reportAction?.actorAccountID)])].filter(Boolean) as number[];
    const existingTransactionThreadReport = getReportOrDraftReport(existingTransactionThreadReportID);

    if (existingTransactionThreadReportID && existingTransactionThreadReport) {
        return {
            ...existingTransactionThreadReport,
            parentReportActionID: reportAction?.reportActionID,
            parentReportID: moneyRequestReport?.reportID,
            reportName: getTransactionReportName({reportAction}),
            policyID: moneyRequestReport?.policyID,
        };
    }

    return buildOptimisticChatReport({
        participantList: participantAccountIDs,
        reportName: getTransactionReportName({reportAction}),
        policyID: moneyRequestReport?.policyID,
        ownerAccountID: CONST.POLICY.OWNER_ACCOUNT_ID_FAKE,
        notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN,
        parentReportActionID: reportAction?.reportActionID,
        parentReportID: moneyRequestReport?.reportID,
    });
}

/**
 * Build optimistic expense entities:
 *
 * 1. CREATED action for the chatReport
 * 2. CREATED action for the iouReport
 * 3. IOU action for the iouReport linked to the transaction thread via `childReportID`
 * 4. Transaction Thread linked to the IOU action via `parentReportActionID`
 * 5. CREATED action for the Transaction Thread
 */
function buildOptimisticMoneyRequestEntities({
    iouReport,
    type,
    amount,
    currency,
    comment,
    payeeEmail,
    participants,
    transactionID,
    paymentType,
    isSettlingUp = false,
    isSendMoneyFlow = false,
    isOwnPolicyExpenseChat = false,
    isPersonalTrackingExpense,
    existingTransactionThreadReportID,
    linkedTrackedExpenseReportAction,
    optimisticCreatedReportActionID,
}: OptimisticMoneyRequestEntities): [OptimisticCreatedReportAction, OptimisticCreatedReportAction, OptimisticIOUReportAction, OptimisticChatReport, OptimisticCreatedReportAction | null] {
    const createdActionForChat = buildOptimisticCreatedReportAction(payeeEmail, undefined, optimisticCreatedReportActionID);

    // The `CREATED` action must be optimistically generated before the IOU action so that it won't appear after the IOU action in the chat.
    const iouActionCreationTime = DateUtils.getDBTime();
    const createdActionForIOUReport = buildOptimisticCreatedReportAction(payeeEmail, DateUtils.subtractMillisecondsFromDateTime(iouActionCreationTime, 1));

    const iouAction = buildOptimisticIOUReportAction({
        type,
        amount,
        currency,
        comment,
        participants,
        transactionID,
        paymentType,
        iouReportID: iouReport.reportID,
        isPersonalTrackingExpense,
        isSettlingUp,
        isSendMoneyFlow,
        isOwnPolicyExpenseChat,
        created: iouActionCreationTime,
        linkedExpenseReportAction: linkedTrackedExpenseReportAction,
    });

    // Create optimistic transactionThread and the `CREATED` action for it, if existingTransactionThreadReportID is undefined
    const transactionThread = buildTransactionThread(iouAction, iouReport, existingTransactionThreadReportID);
    const createdActionForTransactionThread = existingTransactionThreadReportID ? null : buildOptimisticCreatedReportAction(payeeEmail);

    // The IOU action and the transactionThread are co-dependent as parent-child, so we need to link them together
    iouAction.childReportID = existingTransactionThreadReportID ?? transactionThread.reportID;

    return [createdActionForChat, createdActionForIOUReport, iouAction, transactionThread, createdActionForTransactionThread];
}

/**
 * Check if the report is empty, meaning it has no visible messages (i.e. only a "created" report action).
 * Added caching mechanism via derived values.
 */
function isEmptyReport(report: OnyxEntry<Report>): boolean {
    if (!report) {
        return true;
    }

    // Get the `isEmpty` state from cached report attributes
    const attributes = reportAttributesDerivedValue?.[report.reportID];
    if (attributes) {
        return attributes.isEmpty;
    }

    return generateIsEmptyReport(report);
}

/**
 * Check if the report is empty, meaning it has no visible messages (i.e. only a "created" report action).
 * No cache implementation which bypasses derived value check.
 */
function generateIsEmptyReport(report: OnyxEntry<Report>): boolean {
    if (!report) {
        return true;
    }

    if (report.lastMessageText) {
        return false;
    }

    const lastVisibleMessage = getLastVisibleMessage(report.reportID);
    return !lastVisibleMessage.lastMessageText;
}

// We need oneTransactionThreadReport to get the correct last visible action created
function isUnread(report: OnyxEntry<Report>, oneTransactionThreadReport: OnyxEntry<Report>): boolean {
    if (!report) {
        return false;
    }

    if (isEmptyReport(report)) {
        return false;
    }
    // lastVisibleActionCreated and lastReadTime are both datetime strings and can be compared directly
    const lastVisibleActionCreated = getReportLastVisibleActionCreated(report, oneTransactionThreadReport);
    const lastReadTime = report.lastReadTime ?? '';
    const lastMentionedTime = report.lastMentionedTime ?? '';

    // If the user was mentioned and the comment got deleted the lastMentionedTime will be more recent than the lastVisibleActionCreated
    return lastReadTime < (lastVisibleActionCreated ?? '') || lastReadTime < lastMentionedTime;
}

function isIOUOwnedByCurrentUser(report: OnyxEntry<Report>, allReportsDict?: OnyxCollection<Report>): boolean {
    const allAvailableReports = allReportsDict ?? allReports;
    if (!report || !allAvailableReports) {
        return false;
    }

    let reportToLook = report;
    if (report.iouReportID) {
        const iouReport = allAvailableReports[`${ONYXKEYS.COLLECTION.REPORT}${report.iouReportID}`];
        if (iouReport) {
            reportToLook = iouReport;
        }
    }

    return reportToLook.ownerAccountID === currentUserAccountID;
}

/**
 * Assuming the passed in report is a default room, lets us know whether we can see it or not, based on permissions and
 * the various subsets of users we've allowed to use default rooms.
 */
function canSeeDefaultRoom(report: OnyxEntry<Report>, betas: OnyxEntry<Beta[]>): boolean {
    // Include archived rooms
    // This will get removed as part of https://github.com/Expensify/App/issues/59961
    // eslint-disable-next-line deprecation/deprecation
    if (isArchivedNonExpenseReport(report, !!getReportNameValuePairs(report?.reportID)?.private_isArchived)) {
        return true;
    }

    // If the room has an assigned guide, it can be seen.
    if (hasExpensifyGuidesEmails(Object.keys(report?.participants ?? {}).map(Number))) {
        return true;
    }

    // Include any admins and announce rooms, since only non partner-managed domain rooms are on the beta now.
    if (isAdminRoom(report) || isAnnounceRoom(report)) {
        return true;
    }

    // For all other cases, just check that the user belongs to the default rooms beta
    return Permissions.isBetaEnabled(CONST.BETAS.DEFAULT_ROOMS, betas ?? []);
}

function canAccessReport(report: OnyxEntry<Report>, betas: OnyxEntry<Beta[]>): boolean {
    // We hide default rooms (it's basically just domain rooms now) from people who aren't on the defaultRooms beta.
    if (isDefaultRoom(report) && !canSeeDefaultRoom(report, betas)) {
        return false;
    }

    if (report?.errorFields?.notFound) {
        return false;
    }

    return true;
}

// eslint-disable-next-line rulesdir/no-negated-variables
function isReportNotFound(report: OnyxEntry<Report>): boolean {
    return !!report?.errorFields?.notFound;
}

/**
 * Check if the report is the parent report of the currently viewed report or at least one child report has report action
 */
function shouldHideReport(report: OnyxEntry<Report>, currentReportId: string | undefined): boolean {
    const currentReport = getReportOrDraftReport(currentReportId);
    const parentReport = getParentReport(!isEmptyObject(currentReport) ? currentReport : undefined);
    const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report?.reportID}`] ?? {};
    const isChildReportHasComment = Object.values(reportActions ?? {})?.some(
        (reportAction) => (reportAction?.childVisibleActionCount ?? 0) > 0 && shouldReportActionBeVisible(reportAction, reportAction.reportActionID, canUserPerformWriteAction(report)),
    );
    return parentReport?.reportID !== report?.reportID && !isChildReportHasComment;
}

/**
 * Should we display a RBR on the LHN on this report due to violations?
 */
function shouldDisplayViolationsRBRInLHN(report: OnyxEntry<Report>, transactionViolations: OnyxCollection<TransactionViolation[]>): boolean {
    // We only show the RBR in the highest level, which is the expense chat
    if (!report || !isPolicyExpenseChat(report)) {
        return false;
    }

    // We only show the RBR to the submitter
    if (!isCurrentUserSubmitter(report)) {
        return false;
    }
    if (!report.policyID || !reportsByPolicyID) {
        return false;
    }

    // If any report has a violation, then it should have a RBR
    const potentialReports = Object.values(reportsByPolicyID[report.policyID] ?? {}) ?? [];
    return potentialReports.some((potentialReport) => {
        if (!potentialReport) {
            return false;
        }

        return (
            !isInvoiceReport(potentialReport) &&
            (hasViolations(potentialReport.reportID, transactionViolations, true) ||
                hasWarningTypeViolations(potentialReport.reportID, transactionViolations, true) ||
                hasNoticeTypeViolations(potentialReport.reportID, transactionViolations, true))
        );
    });
}

/**
 * Checks to see if a report contains a violation
 */
function hasViolations(
    reportID: string | undefined,
    transactionViolations: OnyxCollection<TransactionViolation[]>,
    shouldShowInReview?: boolean,
    reportTransactions?: SearchTransaction[],
): boolean {
    const transactions = reportTransactions ?? getReportTransactions(reportID);
    return transactions.some((transaction) => hasViolation(transaction, transactionViolations, shouldShowInReview));
}

/**
 * Checks to see if a report contains a violation of type `warning`
 */
function hasWarningTypeViolations(
    reportID: string | undefined,
    transactionViolations: OnyxCollection<TransactionViolation[]>,
    shouldShowInReview?: boolean,
    reportTransactions?: SearchTransaction[],
): boolean {
    const transactions = reportTransactions ?? getReportTransactions(reportID);
    return transactions.some((transaction) => hasWarningTypeViolation(transaction, transactionViolations, shouldShowInReview));
}

/**
 * Checks to see if a transaction contains receipt error
 */
function hasReceiptError(transaction: OnyxInputOrEntry<Transaction>): boolean {
    const errors = {
        ...(transaction?.errorFields?.route ?? transaction?.errorFields?.waypoints ?? transaction?.errors),
    };
    const errorEntries = Object.entries(errors ?? {});
    const errorMessages = mapValues(Object.fromEntries(errorEntries), (error) => error);
    return Object.values(errorMessages).some((error) => isReceiptError(error));
}

/**
 * Checks to see if a report contains receipt error
 */
function hasReceiptErrors(reportID: string | undefined): boolean {
    const transactions = getReportTransactions(reportID);
    return transactions.some(hasReceiptError);
}

/**
 * Checks to see if a report contains a violation of type `notice`
 */
function hasNoticeTypeViolations(
    reportID: string | undefined,
    transactionViolations: OnyxCollection<TransactionViolation[]>,
    shouldShowInReview?: boolean,
    reportTransactions?: SearchTransaction[],
): boolean {
    const transactions = reportTransactions ?? getReportTransactions(reportID);
    return transactions.some((transaction) => hasNoticeTypeViolation(transaction, transactionViolations, shouldShowInReview));
}

/**
 * Checks to see if a report contains any type of violation
 */
function hasAnyViolations(reportID: string | undefined, transactionViolations: OnyxCollection<TransactionViolation[]>, reportTransactions?: SearchTransaction[]) {
    return (
        hasViolations(reportID, transactionViolations, undefined, reportTransactions) ||
        hasNoticeTypeViolations(reportID, transactionViolations, true, reportTransactions) ||
        hasWarningTypeViolations(reportID, transactionViolations, true, reportTransactions)
    );
}

function hasReportViolations(reportID: string | undefined) {
    if (!reportID) {
        return false;
    }
    const reportViolations = allReportsViolations?.[`${ONYXKEYS.COLLECTION.REPORT_VIOLATIONS}${reportID}`];
    return Object.values(reportViolations ?? {}).some((violations) => !isEmptyObject(violations));
}

type ReportErrorsAndReportActionThatRequiresAttention = {
    errors: ErrorFields;
    reportAction?: OnyxEntry<ReportAction>;
};

function getAllReportActionsErrorsAndReportActionThatRequiresAttention(report: OnyxEntry<Report>, reportActions: OnyxEntry<ReportActions>): ReportErrorsAndReportActionThatRequiresAttention {
    const reportActionsArray = Object.values(reportActions ?? {}).filter((action) => !isDeletedAction(action));
    const reportActionErrors: ErrorFields = {};
    let reportAction: OnyxEntry<ReportAction>;

    for (const action of reportActionsArray) {
        if (action && !isEmptyObject(action.errors)) {
            Object.assign(reportActionErrors, action.errors);

            if (!reportAction) {
                reportAction = action;
            }
        }
    }
    const parentReportAction: OnyxEntry<ReportAction> =
        !report?.parentReportID || !report?.parentReportActionID
            ? undefined
            : allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.parentReportID}`]?.[report.parentReportActionID];

    // This will get removed as part of https://github.com/Expensify/App/issues/59961
    // eslint-disable-next-line deprecation/deprecation
    const reportNameValuePairs = getReportNameValuePairs(report?.reportID);

    if (!isArchivedReport(reportNameValuePairs)) {
        if (wasActionTakenByCurrentUser(parentReportAction) && isTransactionThread(parentReportAction)) {
            const transactionID = isMoneyRequestAction(parentReportAction) ? getOriginalMessage(parentReportAction)?.IOUTransactionID : null;
            const transaction = allTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`];
            if (hasMissingSmartscanFieldsTransactionUtils(transaction ?? null) && !isSettled(transaction?.reportID)) {
                reportActionErrors.smartscan = getMicroSecondOnyxErrorWithTranslationKey('iou.error.genericSmartscanFailureMessage');
                reportAction = undefined;
            }
        } else if ((isIOUReport(report) || isExpenseReport(report)) && report?.ownerAccountID === currentUserAccountID) {
            if (shouldShowRBRForMissingSmartscanFields(report?.reportID) && !isSettled(report?.reportID)) {
                reportActionErrors.smartscan = getMicroSecondOnyxErrorWithTranslationKey('iou.error.genericSmartscanFailureMessage');
                reportAction = getReportActionWithMissingSmartscanFields(report?.reportID);
            }
        } else if (hasSmartscanError(reportActionsArray)) {
            reportActionErrors.smartscan = getMicroSecondOnyxErrorWithTranslationKey('iou.error.genericSmartscanFailureMessage');
            reportAction = getReportActionWithSmartscanError(reportActionsArray);
        }
    }

    return {
        errors: reportActionErrors,
        reportAction,
    };
}

/**
 * Get an object of error messages keyed by microtime by combining all error objects related to the report.
 */
function getAllReportErrors(report: OnyxEntry<Report>, reportActions: OnyxEntry<ReportActions>): Errors {
    const reportErrorFields = report?.errorFields ?? {};
    const {errors: reportActionErrors} = getAllReportActionsErrorsAndReportActionThatRequiresAttention(report, reportActions);

    // All error objects related to the report. Each object in the sources contains error messages keyed by microtime
    const errorSources = {
        ...reportErrorFields,
        ...reportActionErrors,
    };

    // Combine all error messages keyed by microtime into one object
    const errorSourcesArray = Object.values(errorSources ?? {});
    const allReportErrors = {};

    for (const errors of errorSourcesArray) {
        if (!isEmptyObject(errors)) {
            Object.assign(allReportErrors, errors);
        }
    }
    return allReportErrors;
}

function hasReportErrorsOtherThanFailedReceipt(
    report: Report,
    chatReport: OnyxEntry<Report>,
    doesReportHaveViolations: boolean,
    transactionViolations: OnyxCollection<TransactionViolation[]>,
    reportAttributes?: ReportAttributesDerivedValue['reports'],
) {
    const allReportErrors = reportAttributes?.[report?.reportID]?.reportErrors ?? {};
    const transactionReportActions = getAllReportActions(report.reportID);
    const oneTransactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, transactionReportActions, undefined);
    let doesTransactionThreadReportHasViolations = false;
    if (oneTransactionThreadReportID) {
        const transactionReport = getReport(oneTransactionThreadReportID, allReports);
        doesTransactionThreadReportHasViolations = !!transactionReport && shouldDisplayViolationsRBRInLHN(transactionReport, transactionViolations);
    }
    return (
        doesTransactionThreadReportHasViolations ||
        doesReportHaveViolations ||
        Object.values(allReportErrors).some((error) => error?.[0] !== translateLocal('iou.error.genericSmartscanFailureMessage'))
    );
}

type ShouldReportBeInOptionListParams = {
    report: OnyxEntry<Report>;
    chatReport: OnyxEntry<Report>;
    currentReportId: string | undefined;
    isInFocusMode: boolean;
    betas: OnyxEntry<Beta[]>;
    excludeEmptyChats: boolean;
    doesReportHaveViolations: boolean;
    includeSelfDM?: boolean;
    login?: string;
    includeDomainEmail?: boolean;
    isReportArchived?: boolean;
};

function reasonForReportToBeInOptionList({
    report,
    chatReport,
    currentReportId,
    isInFocusMode,
    betas,
    excludeEmptyChats,
    doesReportHaveViolations,
    includeSelfDM = false,
    login,
    includeDomainEmail = false,
    isReportArchived = false,
}: ShouldReportBeInOptionListParams): ValueOf<typeof CONST.REPORT_IN_LHN_REASONS> | null {
    const isInDefaultMode = !isInFocusMode;
    // Exclude reports that have no data because there wouldn't be anything to show in the option item.
    // This can happen if data is currently loading from the server or a report is in various stages of being created.
    // This can also happen for anyone accessing a public room or archived room for which they don't have access to the underlying policy.
    // Optionally exclude reports that do not belong to currently active workspace

    const parentReportAction = isThread(report) ? allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.parentReportID}`]?.[report.parentReportActionID] : undefined;

    if (
        !report?.reportID ||
        !report?.type ||
        report?.reportName === undefined ||
        (!report?.participants &&
            // We omit sending back participants for chat rooms when searching for reports since they aren't needed to display the results and can get very large.
            // So we allow showing rooms with no participants–in any other circumstances we should never have these reports with no participants in Onyx.
            !isChatRoom(report) &&
            !isChatThread(report) &&
            !isReportArchived &&
            !isMoneyRequestReport(report) &&
            !isTaskReport(report) &&
            !isSelfDM(report) &&
            !isSystemChat(report) &&
            !isGroupChat(report))
    ) {
        return null;
    }

    const currentReportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report?.reportID}`] ?? {};
    const reportActionValues = Object.values(currentReportActions);
    const hasOnlyCreatedAction = reportActionValues.length === 1 && reportActionValues.at(0)?.actionName === CONST.REPORT.ACTIONS.TYPE.CREATED;

    // Hide empty reports that have only a `CREATED` action, a total of 0, and are in a submitted state
    // These reports should be hidden because they appear empty to users and there is nothing actionable for them to do
    if (report?.total === 0 && report?.stateNum === CONST.REPORT.STATE_NUM.SUBMITTED && report?.statusNum === CONST.REPORT.STATUS_NUM.SUBMITTED && hasOnlyCreatedAction) {
        return null;
    }

    // We used to use the system DM for A/B testing onboarding tasks, but now only create them in the Concierge chat. We
    // still need to allow existing users who have tasks in the system DM to see them, but otherwise we don't need to
    // show that chat
    if (report?.participants?.[CONST.ACCOUNT_ID.NOTIFICATIONS] && isEmptyReport(report)) {
        return null;
    }

    if (!canAccessReport(report, betas)) {
        return null;
    }

    const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report.parentReportID}`];

    // If this is a transaction thread associated with a report that only has one transaction, omit it
    if (isOneTransactionThread(report, parentReport, parentReportAction)) {
        return null;
    }

    if ((Object.values(CONST.REPORT.UNSUPPORTED_TYPE) as string[]).includes(report?.type ?? '')) {
        return null;
    }

    // Include the currently viewed report. If we excluded the currently viewed report, then there
    // would be no way to highlight it in the options list and it would be confusing to users because they lose
    // a sense of context.
    if (report.reportID === currentReportId) {
        return CONST.REPORT_IN_LHN_REASONS.IS_FOCUSED;
    }

    // Retrieve the draft comment for the report and convert it to a boolean
    const hasDraftComment = hasValidDraftComment(report.reportID);

    // Include reports that are relevant to the user in any view mode. Criteria include having a draft or having a GBR showing.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (hasDraftComment) {
        return CONST.REPORT_IN_LHN_REASONS.HAS_DRAFT_COMMENT;
    }

    if (requiresAttentionFromCurrentUser(report, undefined, isReportArchived)) {
        return CONST.REPORT_IN_LHN_REASONS.HAS_GBR;
    }

    const isEmptyChat = isEmptyReport(report);
    const canHideReport = shouldHideReport(report, currentReportId);

    // Include reports if they are pinned
    if (report.isPinned) {
        return CONST.REPORT_IN_LHN_REASONS.PINNED_BY_USER;
    }

    const reportIsSettled = report.statusNum === CONST.REPORT.STATUS_NUM.REIMBURSED;

    // Always show IOU reports with violations unless they are reimbursed
    if (isExpenseRequest(report) && doesReportHaveViolations && !reportIsSettled) {
        return CONST.REPORT_IN_LHN_REASONS.HAS_IOU_VIOLATIONS;
    }

    // Hide only chat threads that haven't been commented on (other threads are actionable)
    if (isChatThread(report) && canHideReport && isEmptyChat) {
        return null;
    }

    // Include reports that have errors from trying to add a workspace
    // If we excluded it, then the red-brock-road pattern wouldn't work for the user to resolve the error
    if (report.errorFields?.addWorkspaceRoom) {
        return CONST.REPORT_IN_LHN_REASONS.HAS_ADD_WORKSPACE_ROOM_ERRORS;
    }

    // All unread chats (even archived ones) in GSD mode will be shown. This is because GSD mode is specifically for focusing the user on the most relevant chats, primarily, the unread ones
    if (isInFocusMode) {
        const oneTransactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.reportID}`]);
        const oneTransactionThreadReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${oneTransactionThreadReportID}`];
        return isUnread(report, oneTransactionThreadReport) && getReportNotificationPreference(report) !== CONST.REPORT.NOTIFICATION_PREFERENCE.MUTE
            ? CONST.REPORT_IN_LHN_REASONS.IS_UNREAD
            : null;
    }

    // Archived reports should always be shown when in default (most recent) mode. This is because you should still be able to access and search for the chats to find them.
    // This will get removed as part of https://github.com/Expensify/App/issues/59961
    // eslint-disable-next-line deprecation/deprecation
    if (isInDefaultMode && isArchivedNonExpenseReport(report, !!getReportNameValuePairs(report?.reportID)?.private_isArchived)) {
        return CONST.REPORT_IN_LHN_REASONS.IS_ARCHIVED;
    }

    // Hide chats between two users that haven't been commented on from the LNH
    if (excludeEmptyChats && isEmptyChat && isChatReport(report) && !isPolicyExpenseChat(report) && !isSystemChat(report) && canHideReport) {
        return null;
    }

    if (isSelfDM(report)) {
        return includeSelfDM ? CONST.REPORT_IN_LHN_REASONS.IS_SELF_DM : null;
    }

    if (Str.isDomainEmail(login ?? '') && !includeDomainEmail) {
        return null;
    }

    // Hide chat threads where the parent message is pending removal
    if (!isEmptyObject(parentReportAction) && isPendingRemove(parentReportAction) && isThreadParentMessage(parentReportAction, report?.reportID)) {
        return null;
    }

    return CONST.REPORT_IN_LHN_REASONS.DEFAULT;
}

/**
 * Takes several pieces of data from Onyx and evaluates if a report should be shown in the option list (either when searching
 * for reports or the reports shown in the LHN).
 *
 * This logic is very specific and the order of the logic is very important. It should fail quickly in most cases and also
 * filter out the majority of reports before filtering out very specific minority of reports.
 */
function shouldReportBeInOptionList(params: ShouldReportBeInOptionListParams) {
    return reasonForReportToBeInOptionList(params) !== null;
}

/**
 * Attempts to find a report in onyx with the provided list of participants. Does not include threads, task, expense, room, and policy expense chat.
 */
function getChatByParticipants(
    newParticipantList: number[],
    reports: OnyxCollection<Report> = allReports,
    shouldIncludeGroupChats = false,
    shouldExcludeClosedReports = false,
): OnyxEntry<Report> {
    const sortedNewParticipantList = newParticipantList.sort();
    return Object.values(reports ?? {}).find((report) => {
        const participantAccountIDs = Object.keys(report?.participants ?? {});

        // This will get removed as part of https://github.com/Expensify/App/issues/59961
        // eslint-disable-next-line deprecation/deprecation
        const reportNameValuePairs = getReportNameValuePairs(report?.reportID);

        if (shouldExcludeClosedReports && isArchivedReport(reportNameValuePairs)) {
            return false;
        }

        // Skip if it's not a 1:1 chat
        if (!shouldIncludeGroupChats && !isOneOnOneChat(report) && !isSystemChat(report)) {
            return false;
        }

        // If we are looking for a group chat, then skip non-group chat report
        if (shouldIncludeGroupChats && !isGroupChat(report)) {
            return false;
        }

        const sortedParticipantsAccountIDs = participantAccountIDs.map(Number).sort();

        // Only return the chat if it has all the participants
        return deepEqual(sortedNewParticipantList, sortedParticipantsAccountIDs);
    });
}

/**
 * Attempts to find an invoice chat report in onyx with the provided policyID and receiverID.
 */
function getInvoiceChatByParticipants(receiverID: string | number, receiverType: InvoiceReceiverType, policyID?: string, reports: OnyxCollection<Report> = allReports): OnyxEntry<Report> {
    return Object.values(reports ?? {}).find((report) => {
        // This will get removed as part of https://github.com/Expensify/App/issues/59961
        // eslint-disable-next-line deprecation/deprecation
        const reportNameValuePairs = getReportNameValuePairs(report?.reportID);
        const isReportArchived = isArchivedReport(reportNameValuePairs);
        if (!report || !isInvoiceRoom(report) || isArchivedNonExpenseReport(report, isReportArchived)) {
            return false;
        }

        const isSameReceiver =
            report.invoiceReceiver &&
            report.invoiceReceiver.type === receiverType &&
            (('accountID' in report.invoiceReceiver && report.invoiceReceiver.accountID === receiverID) ||
                ('policyID' in report.invoiceReceiver && report.invoiceReceiver.policyID === receiverID));

        return report.policyID === policyID && isSameReceiver;
    });
}

/**
 * Attempts to find a policy expense report in onyx that is owned by ownerAccountID in a given policy
 */
function getPolicyExpenseChat(ownerAccountID: number | undefined, policyID: string | undefined, reports = allReports): OnyxEntry<Report> {
    if (!ownerAccountID || !policyID) {
        return;
    }

    return Object.values(reports ?? {}).find((report: OnyxEntry<Report>) => {
        // If the report has been deleted, then skip it
        if (!report) {
            return false;
        }

        return report.policyID === policyID && isPolicyExpenseChat(report) && !isThread(report) && report.ownerAccountID === ownerAccountID;
    });
}

function getAllPolicyReports(policyID: string): Array<OnyxEntry<Report>> {
    return Object.values(allReports ?? {}).filter((report) => report?.policyID === policyID);
}

/**
 * Returns true if Chronos is one of the chat participants (1:1)
 */
function chatIncludesChronos(report: OnyxInputOrEntry<Report> | SearchReport): boolean {
    const participantAccountIDs = Object.keys(report?.participants ?? {}).map(Number);
    return participantAccountIDs.includes(CONST.ACCOUNT_ID.CHRONOS);
}

function chatIncludesChronosWithID(reportOrID?: string | SearchReport): boolean {
    if (!reportOrID) {
        return false;
    }

    const report = typeof reportOrID === 'string' ? getReport(reportOrID, allReports) : reportOrID;
    return chatIncludesChronos(report);
}

/**
 * Can only flag if:
 *
 * - It was written by someone else and isn't a whisper
 * - It's a welcome message whisper
 * - It's an ADD_COMMENT that is not an attachment
 */
function canFlagReportAction(reportAction: OnyxInputOrEntry<ReportAction>, reportID: string | undefined): boolean {
    const isCurrentUserAction = reportAction?.actorAccountID === currentUserAccountID;
    if (isWhisperAction(reportAction)) {
        // Allow flagging whispers that are sent by other users
        if (!isCurrentUserAction && reportAction?.actorAccountID !== CONST.ACCOUNT_ID.CONCIERGE) {
            return true;
        }

        // Disallow flagging the rest of whisper as they are sent by us
        return false;
    }

    let report = getReportOrDraftReport(reportID);

    // If the childReportID exists in reportAction and is equal to the reportID,
    // the report action being evaluated is the parent report action in a thread, and we should get the parent report to evaluate instead.
    if (reportAction?.childReportID?.toString() === reportID?.toString()) {
        report = getReportOrDraftReport(report?.parentReportID);
    }

    return !!(
        !isCurrentUserAction &&
        reportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT &&
        !isDeletedAction(reportAction) &&
        !isCreatedTaskReportAction(reportAction) &&
        !isEmptyObject(report) &&
        report &&
        isAllowedToComment(report)
    );
}

/**
 * Whether flag comment page should show
 */
function shouldShowFlagComment(reportAction: OnyxInputOrEntry<ReportAction>, report: OnyxInputOrEntry<Report>, isReportArchived = false): boolean {
    return (
        canFlagReportAction(reportAction, report?.reportID) &&
        !isArchivedNonExpenseReport(report, isReportArchived) &&
        !chatIncludesChronos(report) &&
        !isConciergeChatReport(report) &&
        reportAction?.actorAccountID !== CONST.ACCOUNT_ID.CONCIERGE
    );
}

/**
 * Performs the markdown conversion, and replaces code points > 127 with C escape sequences
 * Used for compatibility with the backend auth validator for AddComment, and to account for MD in comments
 * @returns The comment's total length as seen from the backend
 */
function getCommentLength(textComment: string, parsingDetails?: ParsingDetails): number {
    return getParsedComment(textComment, parsingDetails)
        .replace(/[^ -~]/g, '\\u????')
        .trim().length;
}

function getRouteFromLink(url: string | null): string {
    if (!url) {
        return '';
    }

    // Get the reportID from URL
    let route = url;
    const localWebAndroidRegEx = /^(https:\/\/([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3}))/;
    linkingConfig.prefixes.forEach((prefix) => {
        if (route.startsWith(prefix)) {
            route = route.replace(prefix, '');
        } else if (localWebAndroidRegEx.test(route)) {
            route = route.replace(localWebAndroidRegEx, '');
        } else {
            return;
        }

        // Remove the port if it's a localhost URL
        if (/^:\d+/.test(route)) {
            route = route.replace(/:\d+/, '');
        }

        // Remove the leading slash if exists
        if (route.startsWith('/')) {
            route = route.replace('/', '');
        }
    });
    return route;
}

function parseReportRouteParams(route: string): ReportRouteParams {
    let parsingRoute = route;
    if (parsingRoute.at(0) === '/') {
        // remove the first slash
        parsingRoute = parsingRoute.slice(1);
    }

    if (!parsingRoute.startsWith(addTrailingForwardSlash(ROUTES.REPORT))) {
        return {reportID: '', isSubReportPageRoute: false};
    }

    const state = getStateFromPath(parsingRoute as Route);
    const focusedRoute = findFocusedRoute(state);

    const reportID = focusedRoute?.params && 'reportID' in focusedRoute.params ? (focusedRoute?.params?.reportID as string) : '';

    if (!reportID) {
        return {reportID: '', isSubReportPageRoute: false};
    }

    return {
        reportID,
        // We're checking the route start with `r/`, the sub report route is the route that we can open from report screen like `r/:reportID/details`
        isSubReportPageRoute: focusedRoute?.name !== SCREENS.REPORT,
    };
}

function getReportIDFromLink(url: string | null): string {
    const route = getRouteFromLink(url);
    const {reportID, isSubReportPageRoute} = parseReportRouteParams(route);
    if (isSubReportPageRoute) {
        // We allow the Sub-Report deep link routes (settings, details, etc.) to be handled by their respective component pages
        return '';
    }
    return reportID;
}

/**
 * Check if the chat report is linked to an iou that is waiting for the current user to add a credit bank account.
 */
function hasIOUWaitingOnCurrentUserBankAccount(chatReport: OnyxInputOrEntry<Report>): boolean {
    if (chatReport?.iouReportID) {
        const iouReport = getReport(chatReport.iouReportID, allReports);
        if (iouReport?.isWaitingOnBankAccount && iouReport?.ownerAccountID === currentUserAccountID) {
            return true;
        }
    }

    return false;
}

/**
 * Users can submit an expense:
 * - in policy expense chats only if they are in a role of a member in the chat (in other words, if it's their policy expense chat)
 * - in an open or submitted expense report tied to a policy expense chat the user owns
 *     - employee can submit expenses in a submitted expense report only if the policy has Instant Submit settings turned on
 * - in an IOU report, which is not settled yet
 * - in a 1:1 DM chat
 */
function canRequestMoney(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>, otherParticipants: number[]): boolean {
    // User cannot submit expenses in a chat thread, task report or in a chat room
    if (isChatThread(report) || isTaskReport(report) || isChatRoom(report) || isSelfDM(report) || isGroupChat(report)) {
        return false;
    }

    // Users can only submit expenses in DMs if they are a 1:1 DM
    if (isDM(report)) {
        return otherParticipants.length === 1;
    }

    // Prevent requesting money if pending IOU report waiting for their bank account already exists
    if (hasIOUWaitingOnCurrentUserBankAccount(report)) {
        return false;
    }

    let isOwnPolicyExpenseChat = report?.isOwnPolicyExpenseChat ?? false;
    if (isExpenseReport(report) && getParentReport(report)) {
        isOwnPolicyExpenseChat = !!getParentReport(report)?.isOwnPolicyExpenseChat;
    }

    // In case there are no other participants than the current user and it's not user's own policy expense chat, they can't submit expenses from such report
    if (otherParticipants.length === 0 && !isOwnPolicyExpenseChat) {
        return false;
    }

    // Current user must be a manager or owner of this IOU
    if (isIOUReport(report) && currentUserAccountID !== report?.managerID && currentUserAccountID !== report?.ownerAccountID) {
        return false;
    }

    if (isMoneyRequestReport(report)) {
        return canAddTransaction(report);
    }

    // In the case of policy expense chat, users can only submit expenses from their own policy expense chat
    return !isPolicyExpenseChat(report) || isOwnPolicyExpenseChat;
}

function isGroupChatAdmin(report: OnyxEntry<Report>, accountID: number) {
    if (!report?.participants) {
        return false;
    }

    const reportParticipants = report.participants ?? {};
    const participant = reportParticipants[accountID];
    return participant?.role === CONST.REPORT.ROLE.ADMIN;
}

/**
 * Helper method to define what expense options we want to show for particular method.
 * There are 4 expense options: Submit, Split, Pay and Track expense:
 * - Submit option should show for:
 *     - DMs
 *     - own policy expense chats
 *     - open and processing expense reports tied to own policy expense chat
 *     - unsettled IOU reports
 * - Pay option should show for:
 *     - DMs
 * - Split options should show for:
 *     - DMs
 *     - chat/policy rooms with more than 1 participant
 *     - groups chats with 2 and more participants
 *     - corporate expense chats
 * - Track expense option should show for:
 *    - Self DMs
 *    - own policy expense chats
 *    - open and processing expense reports tied to own policy expense chat
 * - Send invoice option should show for:
 *    - invoice rooms if the user is an admin of the sender workspace
 * None of the options should show in chat threads or if there is some special Expensify account
 * as a participant of the report.
 */
function getMoneyRequestOptions(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>, reportParticipants: number[], filterDeprecatedTypes = false): IOUType[] {
    const teacherUnitePolicyID = environment === CONST.ENVIRONMENT.PRODUCTION ? CONST.TEACHERS_UNITE.PROD_POLICY_ID : CONST.TEACHERS_UNITE.TEST_POLICY_ID;
    const isTeachersUniteReport = report?.policyID === teacherUnitePolicyID;

    // This will get removed as part of https://github.com/Expensify/App/issues/59961
    // eslint-disable-next-line deprecation/deprecation
    const reportNameValuePairs = getReportNameValuePairs(report?.reportID);

    // In any thread, task report or trip room, we do not allow any new expenses
    if (isChatThread(report) || isTaskReport(report) || isInvoiceReport(report) || isSystemChat(report) || isArchivedReport(reportNameValuePairs) || isTripRoom(report)) {
        return [];
    }

    if (isInvoiceRoom(report)) {
        if (canSendInvoiceFromWorkspace(policy?.id) && isPolicyAdmin(report?.policyID, allPolicies)) {
            return [CONST.IOU.TYPE.INVOICE];
        }
        return [];
    }

    // We don't allow IOU actions if an Expensify account is a participant of the report, unless the policy that the report is on is owned by an Expensify account
    const doParticipantsIncludeExpensifyAccounts = lodashIntersection(reportParticipants, CONST.EXPENSIFY_ACCOUNT_IDS).length > 0;
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policyOwnerAccountID = getPolicy(report?.policyID)?.ownerAccountID;
    const isPolicyOwnedByExpensifyAccounts = policyOwnerAccountID ? CONST.EXPENSIFY_ACCOUNT_IDS.includes(policyOwnerAccountID) : false;
    if (doParticipantsIncludeExpensifyAccounts && !isPolicyOwnedByExpensifyAccounts) {
        // Allow create expense option for Manager McTest report
        if (reportParticipants.some((accountID) => accountID === CONST.ACCOUNT_ID.MANAGER_MCTEST) && Permissions.isBetaEnabled(CONST.BETAS.NEWDOT_MANAGER_MCTEST, allBetas)) {
            return [CONST.IOU.TYPE.SUBMIT];
        }
        return [];
    }

    const otherParticipants = reportParticipants.filter((accountID) => currentUserPersonalDetails?.accountID !== accountID);
    const hasSingleParticipantInReport = otherParticipants.length === 1;
    let options: IOUType[] = [];

    if (isSelfDM(report)) {
        options = [CONST.IOU.TYPE.TRACK];
    }

    if (canRequestMoney(report, policy, otherParticipants)) {
        // For Teachers Unite policy, don't show Create Expense option
        if (!isTeachersUniteReport) {
            options = [...options, CONST.IOU.TYPE.SUBMIT];
            if (!filterDeprecatedTypes) {
                options = [...options, CONST.IOU.TYPE.REQUEST];
            }
        }

        // If the user can request money from the workspace report, they can also track expenses
        if (isPolicyExpenseChat(report) || isExpenseReport(report)) {
            options = [...options, CONST.IOU.TYPE.TRACK];
        }
    }

    // For expense reports on Teachers Unite workspace, disable "Create report" option
    if (isExpenseReport(report) && report?.policyID === teacherUnitePolicyID) {
        options = options.filter((option) => option !== CONST.IOU.TYPE.SUBMIT);
    }

    // User created policy rooms and default rooms like #admins or #announce will always have the Split Expense option
    // unless there are no other participants at all (e.g. #admins room for a policy with only 1 admin)
    // DM chats will have the Split Expense option.
    // Your own expense chats will have the split expense option.
    // Only show Split Expense for TU policy
    if (
        (isChatRoom(report) && !isAnnounceRoom(report) && otherParticipants.length > 0) ||
        (isDM(report) && otherParticipants.length > 0) ||
        (isGroupChat(report) && otherParticipants.length > 0) ||
        (isPolicyExpenseChat(report) && report?.isOwnPolicyExpenseChat && isTeachersUniteReport)
    ) {
        options = [...options, CONST.IOU.TYPE.SPLIT];
    }

    // Pay someone option should be visible only in 1:1 DMs
    if (isDM(report) && hasSingleParticipantInReport) {
        options = [...options, CONST.IOU.TYPE.PAY];
        if (!filterDeprecatedTypes) {
            options = [...options, CONST.IOU.TYPE.SEND];
        }
    }

    return options;
}

/**
 * This is a temporary function to help with the smooth transition with the oldDot.
 * This function will be removed once the transition occurs in oldDot to new links.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
function temporary_getMoneyRequestOptions(
    report: OnyxEntry<Report>,
    policy: OnyxEntry<Policy>,
    reportParticipants: number[],
): Array<Exclude<IOUType, typeof CONST.IOU.TYPE.REQUEST | typeof CONST.IOU.TYPE.SEND | typeof CONST.IOU.TYPE.CREATE | typeof CONST.IOU.TYPE.SPLIT_EXPENSE>> {
    return getMoneyRequestOptions(report, policy, reportParticipants, true) as Array<
        Exclude<IOUType, typeof CONST.IOU.TYPE.REQUEST | typeof CONST.IOU.TYPE.SEND | typeof CONST.IOU.TYPE.CREATE | typeof CONST.IOU.TYPE.SPLIT_EXPENSE>
    >;
}

/**
 * Invoice sender, invoice receiver and auto-invited admins cannot leave
 */
function canLeaveInvoiceRoom(report: OnyxEntry<Report>): boolean {
    if (!report || !report?.invoiceReceiver) {
        return false;
    }

    if (report?.statusNum === CONST.REPORT.STATUS_NUM.CLOSED) {
        return false;
    }
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const isSenderPolicyAdmin = getPolicy(report.policyID)?.role === CONST.POLICY.ROLE.ADMIN;

    if (isSenderPolicyAdmin) {
        return false;
    }

    if (report.invoiceReceiver.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL) {
        return report?.invoiceReceiver?.accountID !== currentUserAccountID;
    }

    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const isReceiverPolicyAdmin = getPolicy(report.invoiceReceiver.policyID)?.role === CONST.POLICY.ROLE.ADMIN;

    if (isReceiverPolicyAdmin) {
        return false;
    }

    return true;
}

function isCurrentUserTheOnlyParticipant(participantAccountIDs?: number[]): boolean {
    return !!(participantAccountIDs?.length === 1 && participantAccountIDs?.at(0) === currentUserAccountID);
}

/**
 * Returns display names for those that can see the whisper.
 * However, it returns "you" if the current user is the only one who can see it besides the person that sent it.
 */
function getWhisperDisplayNames(participantAccountIDs?: number[]): string | undefined {
    const isWhisperOnlyVisibleToCurrentUser = isCurrentUserTheOnlyParticipant(participantAccountIDs);

    // When the current user is the only participant, the display name needs to be "you" because that's the only person reading it
    if (isWhisperOnlyVisibleToCurrentUser) {
        return translateLocal('common.youAfterPreposition');
    }

    return participantAccountIDs?.map((accountID) => getDisplayNameForParticipant({accountID, shouldUseShortForm: !isWhisperOnlyVisibleToCurrentUser})).join(', ');
}

/**
 * Show subscript on expense chats / threads and expense requests
 */
function shouldReportShowSubscript(report: OnyxEntry<Report>, isReportArchived = false): boolean {
    if (isArchivedNonExpenseReport(report, isReportArchived) && !isWorkspaceThread(report)) {
        return false;
    }

    if (isPolicyExpenseChat(report) && !isChatThread(report) && !isTaskReport(report) && !report?.isOwnPolicyExpenseChat) {
        return true;
    }

    if (isPolicyExpenseChat(report) && !isThread(report) && !isTaskReport(report)) {
        return true;
    }

    if (isExpenseRequest(report)) {
        return true;
    }

    if (isExpenseReport(report)) {
        return true;
    }

    if (isWorkspaceTaskReport(report)) {
        return true;
    }

    if (isWorkspaceThread(report)) {
        return true;
    }

    if (isInvoiceRoom(report) || isInvoiceReport(report)) {
        return true;
    }

    return false;
}

/**
 * Return true if reports data exists
 */
function isReportDataReady(): boolean {
    return !isEmptyObject(allReports) && Object.keys(allReports ?? {}).some((key) => allReports?.[key]?.reportID);
}

/**
 * Return true if reportID from path is valid
 */
function isValidReportIDFromPath(reportIDFromPath: string | undefined): boolean {
    return !!reportIDFromPath && !['', 'null', 'undefined', '0', '-1'].includes(reportIDFromPath);
}

/**
 * Return the errors we have when creating a chat, a workspace room, or a new empty report
 */
function getCreationReportErrors(report: OnyxEntry<Report>): Errors | null | undefined {
    // We are either adding a workspace room, creating a chat, or we're creating a report, it isn't possible for all of these to have errors for the same report at the same time, so
    // simply looking up the first truthy value will get the relevant property if it's set.
    return report?.errorFields?.addWorkspaceRoom ?? report?.errorFields?.createChat ?? report?.errorFields?.createReport;
}

/**
 * Return true if the expense report is marked for deletion.
 */
function isMoneyRequestReportPendingDeletion(reportOrID: OnyxEntry<Report> | string): boolean {
    const report = typeof reportOrID === 'string' ? getReport(reportOrID, allReports) : reportOrID;
    if (!isMoneyRequestReport(report)) {
        return false;
    }

    const parentReportAction = getReportAction(report?.parentReportID, report?.parentReportActionID);
    return parentReportAction?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE;
}

function navigateToLinkedReportAction(ancestor: Ancestor, isInNarrowPaneModal: boolean, canUserPerformWrite: boolean | undefined, isOffline: boolean) {
    if (isInNarrowPaneModal) {
        Navigation.navigate(
            ROUTES.SEARCH_REPORT.getRoute({
                reportID: ancestor.report.reportID,
                reportActionID: ancestor.reportAction.reportActionID,
                backTo: SCREENS.SEARCH.REPORT_RHP,
            }),
        );
        return;
    }

    // Pop the thread report screen before navigating to the chat report.
    Navigation.goBack(ROUTES.REPORT_WITH_ID.getRoute(ancestor.report.reportID));

    const isVisibleAction = shouldReportActionBeVisible(ancestor.reportAction, ancestor.reportAction.reportActionID, canUserPerformWrite);

    if (isVisibleAction && !isOffline) {
        // Pop the chat report screen before navigating to the linked report action.
        Navigation.goBack(ROUTES.REPORT_WITH_ID.getRoute(ancestor.report.reportID, ancestor.reportAction.reportActionID));
    }
}

function canUserPerformWriteAction(report: OnyxEntry<Report>) {
    const reportErrors = getCreationReportErrors(report);

    // If the expense report is marked for deletion, let us prevent any further write action.
    if (isMoneyRequestReportPendingDeletion(report)) {
        return false;
    }

    // This will get removed as part of https://github.com/Expensify/App/issues/59961
    // eslint-disable-next-line deprecation/deprecation
    const reportNameValuePairs = getReportNameValuePairs(report?.reportID);
    return (
        !isArchivedNonExpenseReport(report, !!reportNameValuePairs?.private_isArchived) &&
        isEmptyObject(reportErrors) &&
        report &&
        isAllowedToComment(report) &&
        !isAnonymousUser &&
        canWriteInReport(report)
    );
}

/**
 * Returns ID of the original report from which the given reportAction is first created.
 */
function getOriginalReportID(reportID: string | undefined, reportAction: OnyxInputOrEntry<ReportAction>): string | undefined {
    if (!reportID) {
        return undefined;
    }
    const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`];
    const currentReportAction = reportAction?.reportActionID ? reportActions?.[reportAction.reportActionID] : undefined;
    const report = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
    const chatReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.chatReportID}`];
    const transactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, reportActions ?? ([] as ReportAction[]));
    const isThreadReportParentAction = reportAction?.childReportID?.toString() === reportID;
    if (Object.keys(currentReportAction ?? {}).length === 0) {
        return isThreadReportParentAction ? getReport(reportID, allReports)?.parentReportID : (transactionThreadReportID ?? reportID);
    }
    return reportID;
}

/**
 * Return the pendingAction and the errors resulting from either
 *
 * - creating a workspace room
 * - starting a chat
 * - paying the expense
 *
 * while being offline
 */
function getReportOfflinePendingActionAndErrors(report: OnyxEntry<Report>): ReportOfflinePendingActionAndErrors {
    // It shouldn't be possible for all of these actions to be pending (or to have errors) for the same report at the same time, so just take the first that exists
    const reportPendingAction = report?.pendingFields?.addWorkspaceRoom ?? report?.pendingFields?.createChat ?? report?.pendingFields?.reimbursed ?? report?.pendingFields?.createReport;
    const reportErrors = getCreationReportErrors(report);
    return {reportPendingAction, reportErrors};
}

/**
 * Check if the report can create the expense with type is iouType
 */
function canCreateRequest(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>, iouType: ValueOf<typeof CONST.IOU.TYPE>): boolean {
    const participantAccountIDs = Object.keys(report?.participants ?? {}).map(Number);

    if (!canUserPerformWriteAction(report)) {
        return false;
    }

    const requestOptions = getMoneyRequestOptions(report, policy, participantAccountIDs);
    requestOptions.push(CONST.IOU.TYPE.CREATE);

    return requestOptions.includes(iouType);
}

function getWorkspaceChats(policyID: string | undefined, accountIDs: number[], reports: OnyxCollection<Report> = allReports): Array<OnyxEntry<Report>> {
    return Object.values(reports ?? {}).filter(
        (report) => isPolicyExpenseChat(report) && !!policyID && report?.policyID === policyID && report?.ownerAccountID && accountIDs.includes(report?.ownerAccountID),
    );
}

/**
 * Gets all reports that relate to the policy
 *
 * @param policyID - the workspace ID to get all associated reports
 */
function getAllWorkspaceReports(policyID?: string): Array<OnyxEntry<Report>> {
    if (!policyID) {
        return [];
    }
    return Object.values(allReports ?? {}).filter((report) => report?.policyID === policyID);
}

/**
 * @param policy - the workspace the report is on, null if the user isn't a member of the workspace
 */
function shouldDisableRename(report: OnyxEntry<Report>, isReportArchived = false): boolean {
    if (
        isDefaultRoom(report) ||
        isReportArchived ||
        isPublicRoom(report) ||
        isThread(report) ||
        isMoneyRequest(report) ||
        isMoneyRequestReport(report) ||
        isPolicyExpenseChat(report) ||
        isInvoiceRoom(report) ||
        isInvoiceReport(report) ||
        isSystemChat(report)
    ) {
        return true;
    }

    if (isGroupChat(report)) {
        return false;
    }

    if (isDeprecatedGroupDM(report, isReportArchived) || isTaskReport(report)) {
        return true;
    }

    return false;
}

/**
 * @param policy - the workspace the report is on, null if the user isn't a member of the workspace
 */
function canEditWriteCapability(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>, isReportArchived = false): boolean {
    return isPolicyAdminPolicyUtils(policy) && !isAdminRoom(report) && !isReportArchived && !isThread(report) && !isInvoiceRoom(report) && !isPolicyExpenseChat(report);
}

/**
 * @param policy - the workspace the room is on, null if the user isn't a member of the workspace
 * @param isReportArchived - whether the workspace room is archived
 */
function canEditRoomVisibility(policy: OnyxEntry<Policy>, isReportArchived: boolean): boolean {
    return !isReportArchived && isPolicyAdminPolicyUtils(policy);
}

/**
 * Returns the onyx data needed for the task assignee chat
 */
function getTaskAssigneeChatOnyxData(
    accountID: number,
    assigneeAccountID: number,
    taskReportID: string,
    assigneeChatReportID: string,
    parentReportID: string | undefined,
    title: string,
    assigneeChatReport: OnyxEntry<Report>,
): OnyxDataTaskAssigneeChat {
    // Set if we need to add a comment to the assignee chat notifying them that they have been assigned a task
    let optimisticAssigneeAddComment: OptimisticReportAction | undefined;
    // Set if this is a new chat that needs to be created for the assignee
    let optimisticChatCreatedReportAction: OptimisticCreatedReportAction | undefined;
    const assigneeChatReportMetadata = getReportMetadata(assigneeChatReportID);
    const currentTime = DateUtils.getDBTime();
    const optimisticData: OnyxUpdate[] = [];
    const successData: OnyxUpdate[] = [];
    const failureData: OnyxUpdate[] = [];

    // You're able to assign a task to someone you haven't chatted with before - so we need to optimistically create the chat and the chat reportActions
    // Only add the assignee chat report to onyx if we haven't already set it optimistically
    if (assigneeChatReportMetadata?.isOptimisticReport && assigneeChatReport?.pendingFields?.createChat !== CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
        optimisticChatCreatedReportAction = buildOptimisticCreatedReportAction(assigneeChatReportID);
        optimisticData.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${assigneeChatReportID}`,
                value: {
                    pendingFields: {
                        createChat: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    },
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${assigneeChatReportID}`,
                value: {
                    isOptimisticReport: true,
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
                value: {[optimisticChatCreatedReportAction.reportActionID]: optimisticChatCreatedReportAction as Partial<ReportAction>},
            },
        );

        successData.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${assigneeChatReportID}`,
                value: {
                    pendingFields: {
                        createChat: null,
                    },
                    // BE will send a different participant. We clear the optimistic one to avoid duplicated entries
                    participants: {[assigneeAccountID]: null},
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${assigneeChatReportID}`,
                value: {
                    isOptimisticReport: false,
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${assigneeChatReportID}`,
                value: {
                    isOptimisticReport: false,
                },
            },
        );

        failureData.push(
            {
                onyxMethod: Onyx.METHOD.SET,
                key: `${ONYXKEYS.COLLECTION.REPORT}${assigneeChatReportID}`,
                value: null,
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
                value: {[optimisticChatCreatedReportAction.reportActionID]: {pendingAction: null}},
            },
            // If we failed, we want to remove the optimistic personal details as it was likely due to an invalid login
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: ONYXKEYS.PERSONAL_DETAILS_LIST,
                value: {
                    [assigneeAccountID]: null,
                },
            },
        );
    }

    // If you're choosing to share the task in the same DM as the assignee then we don't need to create another reportAction indicating that you've been assigned
    if (assigneeChatReportID !== parentReportID) {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        const displayname = allPersonalDetails?.[assigneeAccountID]?.displayName || allPersonalDetails?.[assigneeAccountID]?.login || '';
        optimisticAssigneeAddComment = buildOptimisticTaskCommentReportAction(taskReportID, title, assigneeAccountID, `assigned to ${displayname}`, parentReportID);
        const lastAssigneeCommentText = formatReportLastMessageText(getReportActionText(optimisticAssigneeAddComment.reportAction as ReportAction));
        const optimisticAssigneeReport = {
            lastVisibleActionCreated: currentTime,
            lastMessageText: lastAssigneeCommentText,
            lastActorAccountID: accountID,
            lastReadTime: currentTime,
        };

        optimisticData.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
                value: {[optimisticAssigneeAddComment.reportAction.reportActionID]: optimisticAssigneeAddComment.reportAction as ReportAction},
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${assigneeChatReportID}`,
                value: optimisticAssigneeReport,
            },
        );
        successData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
            value: {[optimisticAssigneeAddComment.reportAction.reportActionID]: {isOptimisticAction: null}},
        });
        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
            value: {[optimisticAssigneeAddComment.reportAction.reportActionID]: {pendingAction: null}},
        });
    }

    return {
        optimisticData,
        successData,
        failureData,
        optimisticAssigneeAddComment,
        optimisticChatCreatedReportAction,
    };
}

/**
 * Return iou report action display message
 */
function getIOUReportActionDisplayMessage(reportAction: OnyxEntry<ReportAction>, transaction?: OnyxEntry<Transaction>): string {
    if (!isMoneyRequestAction(reportAction)) {
        return '';
    }
    const originalMessage = getOriginalMessage(reportAction);
    const {IOUReportID, automaticAction} = originalMessage ?? {};
    const iouReport = getReportOrDraftReport(IOUReportID);
    let translationKey: TranslationPaths;
    if (originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.PAY) {
        // The `REPORT_ACTION_TYPE.PAY` action type is used for both fulfilling existing requests and sending money. To
        // differentiate between these two scenarios, we check if the `originalMessage` contains the `IOUDetails`
        // property. If it does, it indicates that this is a 'Pay someone' action.
        const {amount, currency} = originalMessage?.IOUDetails ?? originalMessage ?? {};
        const formattedAmount = convertToDisplayString(Math.abs(amount), currency) ?? '';

        switch (originalMessage.paymentType) {
            case CONST.IOU.PAYMENT_TYPE.ELSEWHERE:
                translationKey = hasMissingInvoiceBankAccount(IOUReportID) ? 'iou.payerSettledWithMissingBankAccount' : 'iou.paidElsewhere';
                break;
            case CONST.IOU.PAYMENT_TYPE.EXPENSIFY:
            case CONST.IOU.PAYMENT_TYPE.VBBA:
                translationKey = 'iou.paidWithExpensify';
                if (automaticAction) {
                    translationKey = 'iou.automaticallyPaidWithExpensify';
                }
                break;
            default:
                translationKey = 'iou.payerPaidAmount';
                break;
        }
        return translateLocal(translationKey, {amount: formattedAmount, payer: ''});
    }

    const amount = getTransactionAmount(transaction, !isEmptyObject(iouReport) && isExpenseReport(iouReport), transaction?.reportID === CONST.REPORT.UNREPORTED_REPORT_ID) ?? 0;
    const formattedAmount = convertToDisplayString(amount, getCurrency(transaction)) ?? '';
    const isRequestSettled = isSettled(IOUReportID);
    const isApproved = isReportApproved({report: iouReport});
    if (isRequestSettled) {
        return translateLocal('iou.payerSettled', {
            amount: formattedAmount,
        });
    }
    if (isApproved) {
        return translateLocal('iou.approvedAmount', {
            amount: formattedAmount,
        });
    }
    if (isSplitBillReportAction(reportAction)) {
        translationKey = 'iou.didSplitAmount';
    } else if (isTrackExpenseAction(reportAction)) {
        translationKey = 'iou.trackedAmount';
    } else {
        translationKey = 'iou.expenseAmount';
    }
    return translateLocal(translationKey, {
        formattedAmount,
        comment: getMerchantOrDescription(transaction),
    });
}

/**
 * Checks if a report is a group chat.
 *
 * A report is a group chat if it meets the following conditions:
 * - Not a chat thread.
 * - Not a task report.
 * - Not an expense / IOU report.
 * - Not an archived room.
 * - Not a public / admin / announce chat room (chat type doesn't match any of the specified types).
 * - More than 2 participants.
 *
 */
function isDeprecatedGroupDM(report: OnyxEntry<Report>, isReportArchived = false): boolean {
    return !!(
        report &&
        !isChatThread(report) &&
        !isTaskReport(report) &&
        !isInvoiceReport(report) &&
        !isMoneyRequestReport(report) &&
        !isReportArchived &&
        !Object.values(CONST.REPORT.CHAT_TYPE).some((chatType) => chatType === getChatType(report)) &&
        Object.keys(report.participants ?? {})
            .map(Number)
            .filter((accountID) => accountID !== currentUserAccountID).length > 1
    );
}

/**
 * A "root" group chat is the top level group chat and does not refer to any threads off of a Group Chat
 */
function isRootGroupChat(report: OnyxEntry<Report>, isReportArchived = false): boolean {
    return !isChatThread(report) && (isGroupChat(report) || isDeprecatedGroupDM(report, isReportArchived));
}

/**
 * Assume any report without a reportID is unusable.
 */
function isValidReport(report?: OnyxEntry<Report>): boolean {
    return !!report?.reportID;
}

/**
 * Check to see if we are a participant of this report.
 */
function isReportParticipant(accountID: number | undefined, report: OnyxEntry<Report>): boolean {
    if (!accountID) {
        return false;
    }

    const possibleAccountIDs = Object.keys(report?.participants ?? {}).map(Number);
    if (report?.ownerAccountID) {
        possibleAccountIDs.push(report?.ownerAccountID);
    }
    if (report?.managerID) {
        possibleAccountIDs.push(report?.managerID);
    }
    return possibleAccountIDs.includes(accountID);
}

/**
 * Check to see if the current user has access to view the report.
 */
function canCurrentUserOpenReport(report: OnyxEntry<Report>): boolean {
    return (isReportParticipant(currentUserAccountID, report) || isPublicRoom(report)) && canAccessReport(report, allBetas);
}

function shouldUseFullTitleToDisplay(report: OnyxEntry<Report>): boolean {
    return (
        isMoneyRequestReport(report) || isPolicyExpenseChat(report) || isChatRoom(report) || isChatThread(report) || isTaskReport(report) || isGroupChat(report) || isInvoiceReport(report)
    );
}

function getRoom(type: ValueOf<typeof CONST.REPORT.CHAT_TYPE>, policyID: string): OnyxEntry<Report> {
    const room = Object.values(allReports ?? {}).find((report) => report?.policyID === policyID && report?.chatType === type && !isThread(report));
    return room;
}

/**
 *  We only want policy members who are members of the report to be able to modify the report description, but not in thread chat.
 */
function canEditReportDescription(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>, isReportArchived = false): boolean {
    return (
        !isMoneyRequestReport(report) &&
        !isReportArchived &&
        isChatRoom(report) &&
        !isChatThread(report) &&
        !isEmpty(policy) &&
        hasParticipantInArray(report, currentUserAccountID ? [currentUserAccountID] : []) &&
        !isAuditor(report)
    );
}

function canEditPolicyDescription(policy: OnyxEntry<Policy>): boolean {
    return isPolicyAdminPolicyUtils(policy);
}

function getReportActionWithSmartscanError(reportActions: ReportAction[]): ReportAction | undefined {
    return reportActions.find((action) => {
        const isReportPreview = isReportPreviewAction(action);
        const isSplitReportAction = isSplitBillReportAction(action);
        if (!isSplitReportAction && !isReportPreview) {
            return false;
        }
        const IOUReportID = getIOUReportIDFromReportActionPreview(action);
        const isReportPreviewError = isReportPreview && shouldShowRBRForMissingSmartscanFields(IOUReportID) && !isSettled(IOUReportID);
        if (isReportPreviewError) {
            return true;
        }

        const transactionID = isMoneyRequestAction(action) ? getOriginalMessage(action)?.IOUTransactionID : undefined;
        const transaction = allTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`] ?? {};
        const isSplitBillError = isSplitReportAction && hasMissingSmartscanFieldsTransactionUtils(transaction as Transaction);

        return isSplitBillError;
    });
}

/**
 * Checks if report action has error when smart scanning
 */
function hasSmartscanError(reportActions: ReportAction[]): boolean {
    return !!getReportActionWithSmartscanError(reportActions);
}

function shouldAutoFocusOnKeyPress(event: KeyboardEvent): boolean {
    if (event.key.length > 1) {
        return false;
    }

    // If a key is pressed in combination with Meta, Control or Alt do not focus
    if (event.ctrlKey || event.metaKey) {
        return false;
    }

    if (event.code === 'Space') {
        return false;
    }

    return true;
}

/**
 * Navigates to the appropriate screen based on the presence of a private note for the current user.
 */
function navigateToPrivateNotes(report: OnyxEntry<Report>, session: OnyxEntry<Session>, backTo?: string) {
    if (isEmpty(report) || isEmpty(session) || !session.accountID) {
        return;
    }
    const currentUserPrivateNote = report.privateNotes?.[session.accountID]?.note ?? '';
    if (isEmpty(currentUserPrivateNote)) {
        Navigation.navigate(ROUTES.PRIVATE_NOTES_EDIT.getRoute(report.reportID, session.accountID, backTo));
        return;
    }
    Navigation.navigate(ROUTES.PRIVATE_NOTES_LIST.getRoute(report.reportID, backTo));
}

/**
 * Get all held transactions of a iouReport
 */
function getAllHeldTransactions(iouReportID?: string): Transaction[] {
    const transactions = getReportTransactions(iouReportID);
    return transactions.filter((transaction) => isOnHoldTransactionUtils(transaction));
}

/**
 * Check if Report has any held expenses
 */
function hasHeldExpenses(iouReportID?: string, allReportTransactions?: SearchTransaction[]): boolean {
    const iouReportTransactions = getReportTransactions(iouReportID);
    const transactions = allReportTransactions ?? iouReportTransactions;
    return transactions.some((transaction) => isOnHoldTransactionUtils(transaction));
}

/**
 * Check if all expenses in the Report are on hold
 */
function hasOnlyHeldExpenses(iouReportID?: string, allReportTransactions?: SearchTransaction[]): boolean {
    const transactionsByIouReportID = getReportTransactions(iouReportID);
    const reportTransactions = allReportTransactions ?? transactionsByIouReportID;
    return reportTransactions.length > 0 && !reportTransactions.some((transaction) => !isOnHoldTransactionUtils(transaction));
}

/**
 * Checks if thread replies should be displayed
 */
function shouldDisplayThreadReplies(reportAction: OnyxInputOrEntry<ReportAction>, isThreadReportParentAction: boolean): boolean {
    const hasReplies = (reportAction?.childVisibleActionCount ?? 0) > 0;
    return hasReplies && !!reportAction?.childCommenterCount && !isThreadReportParentAction;
}

/**
 * Check if money report has any transactions updated optimistically
 */
function hasUpdatedTotal(report: OnyxInputOrEntry<Report>, policy: OnyxInputOrEntry<Policy>): boolean {
    if (!report) {
        return true;
    }

    const allReportTransactions = getReportTransactions(report.reportID);

    const hasPendingTransaction = allReportTransactions.some((transaction) => !!transaction.pendingAction);
    const hasTransactionWithDifferentCurrency = allReportTransactions.some((transaction) => transaction.currency !== report.currency);
    const hasDifferentWorkspaceCurrency = report.pendingFields?.createChat && isExpenseReport(report) && report.currency !== policy?.outputCurrency;
    const hasOptimisticHeldExpense = hasHeldExpenses(report.reportID) && report?.unheldTotal === undefined;

    return !(hasPendingTransaction && (hasTransactionWithDifferentCurrency || hasDifferentWorkspaceCurrency)) && !hasOptimisticHeldExpense && !report.pendingFields?.total;
}

/**
 * Return held and full amount formatted with used currency
 */
function getNonHeldAndFullAmount(iouReport: OnyxEntry<Report>, shouldExcludeNonReimbursables: boolean): NonHeldAndFullAmount {
    // if the report is an expense report, the total amount should be negated
    const coefficient = isExpenseReport(iouReport) ? -1 : 1;

    let total = iouReport?.total ?? 0;
    let unheldTotal = iouReport?.unheldTotal ?? 0;
    if (shouldExcludeNonReimbursables) {
        total -= iouReport?.nonReimbursableTotal ?? 0;
        unheldTotal -= iouReport?.unheldNonReimbursableTotal ?? 0;
    }

    return {
        nonHeldAmount: convertToDisplayString(unheldTotal * coefficient, iouReport?.currency),
        fullAmount: convertToDisplayString(total * coefficient, iouReport?.currency),
        hasValidNonHeldAmount: unheldTotal * coefficient >= 0,
    };
}

/**
 * Disable reply in thread action if:
 *
 * - The action is listed in the thread-disabled list
 * - The action is a split expense action
 * - The action is deleted and is not threaded
 * - The report is archived and the action is not threaded
 * - The action is a whisper action and it's neither a report preview nor IOU action
 * - The action is the thread's first chat
 */
function shouldDisableThread(reportAction: OnyxInputOrEntry<ReportAction>, reportID: string, isThreadReportParentAction: boolean, isReportArchived = false): boolean {
    const isSplitBillAction = isSplitBillReportAction(reportAction);
    const isDeletedActionLocal = isDeletedAction(reportAction);
    const isReportPreviewActionLocal = isReportPreviewAction(reportAction);
    const isIOUAction = isMoneyRequestAction(reportAction);
    const isWhisperActionLocal = isWhisperAction(reportAction) || isActionableTrackExpense(reportAction);
    const isActionDisabled = CONST.REPORT.ACTIONS.THREAD_DISABLED.some((action: string) => action === reportAction?.actionName);

    return (
        isActionDisabled ||
        isSplitBillAction ||
        (isDeletedActionLocal && !reportAction?.childVisibleActionCount) ||
        (isReportArchived && !reportAction?.childVisibleActionCount) ||
        (isWhisperActionLocal && !isReportPreviewActionLocal && !isIOUAction) ||
        isThreadReportParentAction
    );
}

function getAllAncestorReportActions(report: Report | null | undefined, currentUpdatedReport?: OnyxEntry<Report>): Ancestor[] {
    if (!report) {
        return [];
    }
    const allAncestors: Ancestor[] = [];
    let parentReportID = report.parentReportID;
    let parentReportActionID = report.parentReportActionID;

    while (parentReportID) {
        const parentReport = currentUpdatedReport && currentUpdatedReport.reportID === parentReportID ? currentUpdatedReport : getReportOrDraftReport(parentReportID);
        const parentReportAction = getReportAction(parentReportID, parentReportActionID);

        if (!parentReport || !parentReportAction || (isTransactionThread(parentReportAction) && !isSentMoneyReportAction(parentReportAction)) || isReportPreviewAction(parentReportAction)) {
            break;
        }

        // For threads, we don't want to display trip summary
        if (isTripPreview(parentReportAction) && allAncestors.length > 0) {
            break;
        }

        const isParentReportActionUnread = isCurrentActionUnread(parentReport, parentReportAction);
        allAncestors.push({
            report: parentReport,
            reportAction: parentReportAction,
            shouldDisplayNewMarker: isParentReportActionUnread,
        });

        parentReportID = parentReport?.parentReportID;
        parentReportActionID = parentReport?.parentReportActionID;
    }

    return allAncestors.reverse();
}

function getAllAncestorReportActionIDs(report: Report | null | undefined, includeTransactionThread = false): AncestorIDs {
    if (!report) {
        return {
            reportIDs: [],
            reportActionsIDs: [],
        };
    }

    const allAncestorIDs: AncestorIDs = {
        reportIDs: [],
        reportActionsIDs: [],
    };
    let parentReportID = report.parentReportID;
    let parentReportActionID = report.parentReportActionID;

    while (parentReportID) {
        const parentReport = getReportOrDraftReport(parentReportID);
        const parentReportAction = getReportAction(parentReportID, parentReportActionID);

        if (
            !parentReportAction ||
            (!includeTransactionThread && ((isTransactionThread(parentReportAction) && !isSentMoneyReportAction(parentReportAction)) || isReportPreviewAction(parentReportAction)))
        ) {
            break;
        }

        allAncestorIDs.reportIDs.push(parentReportID);
        if (parentReportActionID) {
            allAncestorIDs.reportActionsIDs.push(parentReportActionID);
        }

        if (!parentReport) {
            break;
        }

        parentReportID = parentReport?.parentReportID;
        parentReportActionID = parentReport?.parentReportActionID;
    }

    return allAncestorIDs;
}

/**
 * Get optimistic data of parent report action
 * @param reportID The reportID of the report that is updated
 * @param lastVisibleActionCreated Last visible action created of the child report
 * @param type The type of action in the child report
 */
function getOptimisticDataForParentReportAction(reportID: string | undefined, lastVisibleActionCreated: string, type: string): Array<OnyxUpdate | null> {
    const report = getReportOrDraftReport(reportID);

    if (!report || isEmptyObject(report)) {
        return [];
    }

    const ancestors = getAllAncestorReportActionIDs(report, true);
    const totalAncestor = ancestors.reportIDs.length;

    return Array.from(Array(totalAncestor), (_, index) => {
        const ancestorReport = getReportOrDraftReport(ancestors.reportIDs.at(index));

        if (!ancestorReport || isEmptyObject(ancestorReport)) {
            return null;
        }

        const ancestorReportAction = getReportAction(ancestorReport.reportID, ancestors.reportActionsIDs.at(index) ?? '');

        if (!ancestorReportAction?.reportActionID || isEmptyObject(ancestorReportAction)) {
            return null;
        }

        return {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${ancestorReport.reportID}`,
            value: {
                [ancestorReportAction.reportActionID]: updateOptimisticParentReportAction(ancestorReportAction, lastVisibleActionCreated, type),
            },
        };
    });
}

function getQuickActionDetails(
    quickActionReport: Report,
    personalDetails: PersonalDetailsList | undefined,
    policyChatForActivePolicy: Report | undefined,
    reportNameValuePairs: ReportNameValuePairs,
): {quickActionAvatars: Icon[]; hideQABSubtitle: boolean} {
    const isValidQuickActionReport = !(isEmptyObject(quickActionReport) || isArchivedReport(reportNameValuePairs));
    let hideQABSubtitle = false;
    let quickActionAvatars: Icon[] = [];
    if (isValidQuickActionReport) {
        const avatars = getIcons(quickActionReport, personalDetails);
        quickActionAvatars = avatars.length <= 1 || isPolicyExpenseChat(quickActionReport) ? avatars : avatars.filter((avatar) => avatar.id !== currentUserAccountID);
    } else {
        hideQABSubtitle = true;
    }
    if (!isEmptyObject(policyChatForActivePolicy)) {
        quickActionAvatars = getIcons(policyChatForActivePolicy, personalDetails);
    }
    return {
        quickActionAvatars,
        hideQABSubtitle,
    };
}

function canBeAutoReimbursed(report: OnyxInputOrEntry<Report>, policy: OnyxInputOrEntry<Policy> | SearchPolicy): boolean {
    if (isEmptyObject(policy)) {
        return false;
    }
    type CurrencyType = TupleToUnion<typeof CONST.DIRECT_REIMBURSEMENT_CURRENCIES>;
    const reimbursableTotal = getMoneyRequestSpendBreakdown(report).totalDisplaySpend;
    const autoReimbursementLimit = policy?.autoReimbursement?.limit ?? policy?.autoReimbursementLimit ?? 0;
    const isAutoReimbursable =
        isReportInGroupPolicy(report) &&
        policy.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_YES &&
        autoReimbursementLimit >= reimbursableTotal &&
        reimbursableTotal > 0 &&
        CONST.DIRECT_REIMBURSEMENT_CURRENCIES.includes(report?.currency as CurrencyType);
    return isAutoReimbursable;
}

/** Check if the current user is an owner of the report */
function isReportOwner(report: OnyxInputOrEntry<Report>): boolean {
    return report?.ownerAccountID === currentUserPersonalDetails?.accountID;
}

function isAllowedToApproveExpenseReport(report: OnyxEntry<Report>, approverAccountID?: number, reportPolicy?: OnyxEntry<Policy> | SearchPolicy): boolean {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = reportPolicy ?? getPolicy(report?.policyID);
    const isOwner = (approverAccountID ?? currentUserAccountID) === report?.ownerAccountID;
    return !(policy?.preventSelfApproval && isOwner);
}

function isAllowedToSubmitDraftExpenseReport(report: OnyxEntry<Report>): boolean {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(report?.policyID);
    const submitToAccountID = getSubmitToAccountID(policy, report);

    return isAllowedToApproveExpenseReport(report, submitToAccountID);
}

/**
 * What missing payment method does this report action indicate, if any?
 */
function getIndicatedMissingPaymentMethod(userWallet: OnyxEntry<UserWallet>, reportId: string | undefined, reportAction: ReportAction): MissingPaymentMethod | undefined {
    const isSubmitterOfUnsettledReport = reportId && isCurrentUserSubmitter(getReport(reportId, allReports)) && !isSettled(reportId);
    if (!reportId || !isSubmitterOfUnsettledReport || !isReimbursementQueuedAction(reportAction)) {
        return undefined;
    }
    const paymentType = getOriginalMessage(reportAction)?.paymentType;
    if (paymentType === CONST.IOU.PAYMENT_TYPE.EXPENSIFY) {
        return isEmpty(userWallet) || userWallet.tierName === CONST.WALLET.TIER_NAME.SILVER ? 'wallet' : undefined;
    }

    return !hasCreditBankAccount() ? 'bankAccount' : undefined;
}

/**
 * Checks if report chat contains missing payment method
 */
function hasMissingPaymentMethod(userWallet: OnyxEntry<UserWallet>, iouReportID: string | undefined): boolean {
    const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${iouReportID}`] ?? {};
    return Object.values(reportActions)
        .filter(Boolean)
        .some((action) => getIndicatedMissingPaymentMethod(userWallet, iouReportID, action) !== undefined);
}

/**
 * Used from expense actions to decide if we need to build an optimistic expense report.
 * Create a new report if:
 * - we don't have an iouReport set in the chatReport
 * - we have one, but it's waiting on the payee adding a bank account
 * - we have one, but we can't add more transactions to it due to: report is approved or settled
 */
function shouldCreateNewMoneyRequestReport(existingIOUReport: OnyxInputOrEntry<Report> | undefined, chatReport: OnyxInputOrEntry<Report>, isScanRequest: boolean): boolean {
    const isASAPSubmitBetaEnabled = Permissions.isBetaEnabled(CONST.BETAS.ASAP_SUBMIT, allBetas);
    return !existingIOUReport || hasIOUWaitingOnCurrentUserBankAccount(chatReport) || !canAddTransaction(existingIOUReport) || (isScanRequest && isASAPSubmitBetaEnabled);
}

function getTripIDFromTransactionParentReportID(transactionParentReportID: string | undefined): string | undefined {
    return (getReportOrDraftReport(transactionParentReportID) as OnyxEntry<Report>)?.tripData?.tripID;
}

/**
 * Checks if report contains actions with errors
 */
function hasActionWithErrorsForTransaction(reportID: string | undefined, transaction: Transaction | undefined): boolean {
    if (!reportID) {
        return false;
    }
    const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`] ?? {};
    return Object.values(reportActions)
        .filter(Boolean)
        .some((action) => {
            if (isMoneyRequestAction(action) && getOriginalMessage(action)?.IOUTransactionID) {
                if (getOriginalMessage(action)?.IOUTransactionID === transaction?.transactionID) {
                    return !isEmptyObject(action.errors);
                }
                return false;
            }
            return !isEmptyObject(action.errors);
        });
}

function isNonAdminOrOwnerOfPolicyExpenseChat(report: OnyxInputOrEntry<Report>, policy: OnyxInputOrEntry<Policy>): boolean {
    return isPolicyExpenseChat(report) && !(isPolicyAdminPolicyUtils(policy) || isPolicyOwner(policy, currentUserAccountID) || isReportOwner(report));
}

function isAdminOwnerApproverOrReportOwner(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>): boolean {
    const isApprover = isMoneyRequestReport(report) && report?.managerID !== null && currentUserPersonalDetails?.accountID === report?.managerID;

    return isPolicyAdminPolicyUtils(policy) || isPolicyOwner(policy, currentUserAccountID) || isReportOwner(report) || isApprover;
}

/**
 * Whether the user can join a report
 */
function canJoinChat(report: OnyxEntry<Report>, parentReportAction: OnyxInputOrEntry<ReportAction>, policy: OnyxInputOrEntry<Policy>, isReportArchived = false): boolean {
    // We disabled thread functions for whisper action
    // So we should not show join option for existing thread on whisper message that has already been left, or manually leave it
    if (isWhisperAction(parentReportAction)) {
        return false;
    }

    // If the notification preference of the chat is not hidden that means we have already joined the chat
    if (!isHiddenForCurrentUser(report)) {
        return false;
    }

    const isExpenseChat = isMoneyRequestReport(report) || isMoneyRequest(report) || isInvoiceReport(report) || isTrackExpenseReport(report);
    // Anyone viewing these chat types is already a participant and therefore cannot join
    if (isRootGroupChat(report, isReportArchived) || isSelfDM(report) || isInvoiceRoom(report) || isSystemChat(report) || isExpenseChat) {
        return false;
    }

    // The user who is a member of the workspace has already joined the public announce room.
    if (isPublicAnnounceRoom(report) && !isEmptyObject(policy)) {
        return false;
    }

    if (isReportArchived) {
        return false;
    }

    return isChatThread(report) || isUserCreatedPolicyRoom(report) || isNonAdminOrOwnerOfPolicyExpenseChat(report, policy);
}

/**
 * Whether the user can leave a report
 */
function canLeaveChat(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>, isReportArchived = false): boolean {
    if (isRootGroupChat(report, isReportArchived)) {
        return true;
    }

    if (isPolicyExpenseChat(report) && !report?.isOwnPolicyExpenseChat && !isPolicyAdminPolicyUtils(policy)) {
        return true;
    }

    if (isPublicRoom(report) && isAnonymousUserSession()) {
        return false;
    }

    if (isHiddenForCurrentUser(report)) {
        return false;
    }

    // Anyone viewing these chat types is already a participant and therefore cannot leave
    if (isSelfDM(report)) {
        return false;
    }

    // The user who is a member of the workspace cannot leave the public announce room.
    if (isPublicAnnounceRoom(report) && !isEmptyObject(policy)) {
        return false;
    }

    if (isInvoiceRoom(report)) {
        return canLeaveInvoiceRoom(report);
    }

    return (isChatThread(report) && !!getReportNotificationPreference(report)) || isUserCreatedPolicyRoom(report) || isNonAdminOrOwnerOfPolicyExpenseChat(report, policy);
}

function getReportActionActorAccountID(
    reportAction: OnyxEntry<ReportAction>,
    iouReport: OnyxEntry<Report>,
    report: OnyxEntry<Report>,
    delegatePersonalDetails?: PersonalDetails | undefined | null,
): number | undefined {
    switch (reportAction?.actionName) {
        case CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW: {
            const ownerAccountID = iouReport?.ownerAccountID ?? reportAction?.childOwnerAccountID;
            const actorAccountID = iouReport?.managerID ?? reportAction?.childManagerAccountID;

            if (isPolicyExpenseChat(report) || delegatePersonalDetails) {
                return ownerAccountID;
            }

            return actorAccountID;
        }

        case CONST.REPORT.ACTIONS.TYPE.SUBMITTED:
            return reportAction?.adminAccountID ?? reportAction?.actorAccountID;

        default:
            return reportAction?.actorAccountID;
    }
}

function createDraftWorkspaceAndNavigateToConfirmationScreen(transactionID: string, actionName: IOUAction): void {
    const isCategorizing = actionName === CONST.IOU.ACTION.CATEGORIZE;
    const {expenseChatReportID, policyID, policyName} = createDraftWorkspace(currentUserEmail);
    setMoneyRequestParticipants(transactionID, [
        {
            selected: true,
            accountID: 0,
            isPolicyExpenseChat: true,
            reportID: expenseChatReportID,
            policyID,
            searchText: policyName,
        },
    ]);
    if (isCategorizing) {
        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CATEGORY.getRoute(actionName, CONST.IOU.TYPE.SUBMIT, transactionID, expenseChatReportID));
    } else {
        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(actionName, CONST.IOU.TYPE.SUBMIT, transactionID, expenseChatReportID, undefined, true));
    }
}

function createDraftTransactionAndNavigateToParticipantSelector(
    transactionID: string | undefined,
    reportID: string | undefined,
    actionName: IOUAction,
    reportActionID: string | undefined,
): void {
    if (!transactionID || !reportID) {
        return;
    }

    const transaction = allTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`] ?? ({} as Transaction);
    const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`] ?? ([] as ReportAction[]);

    if (!transaction || !reportActions) {
        return;
    }

    const linkedTrackedExpenseReportAction = Object.values(reportActions)
        .filter(Boolean)
        .find((action) => isMoneyRequestAction(action) && getOriginalMessage(action)?.IOUTransactionID === transactionID);

    const {created, amount, currency, merchant, mccGroup} = getTransactionDetails(transaction) ?? {};
    const comment = getTransactionCommentObject(transaction);

    createDraftTransaction({
        ...transaction,
        actionableWhisperReportActionID: reportActionID,
        linkedTrackedExpenseReportAction,
        linkedTrackedExpenseReportID: reportID,
        created,
        modifiedCreated: undefined,
        modifiedAmount: undefined,
        modifiedCurrency: undefined,
        amount,
        currency,
        comment,
        merchant,
        modifiedMerchant: '',
        mccGroup,
    } as Transaction);

    const filteredPolicies = Object.values(allPolicies ?? {}).filter((policy) => shouldShowPolicy(policy, false, currentUserEmail));

    if (actionName === CONST.IOU.ACTION.CATEGORIZE) {
        // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
        // eslint-disable-next-line deprecation/deprecation
        const activePolicy = getPolicy(activePolicyID);
        if (activePolicy && shouldRestrictUserBillableActions(activePolicy.id)) {
            Navigation.navigate(ROUTES.RESTRICTED_ACTION.getRoute(activePolicy.id));
            return;
        }

        if (shouldShowPolicy(activePolicy, false, currentUserEmail)) {
            const policyExpenseReportID = getPolicyExpenseChat(currentUserAccountID, activePolicyID)?.reportID;
            setMoneyRequestParticipants(transactionID, [
                {
                    selected: true,
                    accountID: 0,
                    isPolicyExpenseChat: true,
                    reportID: policyExpenseReportID,
                    policyID: activePolicyID,
                    searchText: activePolicy?.name,
                },
            ]);
            if (policyExpenseReportID) {
                Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CATEGORY.getRoute(actionName, CONST.IOU.TYPE.SUBMIT, transactionID, policyExpenseReportID));
            } else {
                Log.warn('policyExpenseReportID is not valid during expense categorizing');
            }
            return;
        }
        if (filteredPolicies.length === 0 || filteredPolicies.length > 1) {
            Navigation.navigate(ROUTES.MONEY_REQUEST_UPGRADE.getRoute(actionName, CONST.IOU.TYPE.SUBMIT, transactionID, reportID));
            return;
        }

        const policyID = filteredPolicies.at(0)?.id;
        const policyExpenseReportID = getPolicyExpenseChat(currentUserAccountID, policyID)?.reportID;
        setMoneyRequestParticipants(transactionID, [
            {
                selected: true,
                accountID: 0,
                isPolicyExpenseChat: true,
                reportID: policyExpenseReportID,
                policyID,
                searchText: activePolicy?.name,
            },
        ]);
        if (policyExpenseReportID) {
            Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CATEGORY.getRoute(actionName, CONST.IOU.TYPE.SUBMIT, transactionID, policyExpenseReportID));
        } else {
            Log.warn('policyExpenseReportID is not valid during expense categorizing');
        }
        return;
    }

    if (actionName === CONST.IOU.ACTION.SHARE) {
        Navigation.navigate(ROUTES.MONEY_REQUEST_ACCOUNTANT.getRoute(actionName, CONST.IOU.TYPE.SUBMIT, transactionID, reportID, Navigation.getActiveRoute()));
        return;
    }

    if (actionName === CONST.IOU.ACTION.SUBMIT || (allPolicies && filteredPolicies.length > 0)) {
        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_PARTICIPANTS.getRoute(CONST.IOU.TYPE.SUBMIT, transactionID, reportID, undefined, actionName));
        return;
    }

    return createDraftWorkspaceAndNavigateToConfirmationScreen(transactionID, actionName);
}

/**
 * Check if a report has any forwarded actions
 */
function hasForwardedAction(reportID: string): boolean {
    const reportActions = getAllReportActions(reportID);
    return Object.values(reportActions).some((action) => action?.actionName === CONST.REPORT.ACTIONS.TYPE.FORWARDED);
}

function isReportOutstanding(
    iouReport: OnyxInputOrEntry<Report>,
    policyID: string | undefined,
    reportNameValuePairs: OnyxCollection<ReportNameValuePairs> = allReportNameValuePair,
): boolean {
    if (!iouReport || isEmptyObject(iouReport)) {
        return false;
    }
    const reportNameValuePair = reportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${iouReport.reportID}`];
    return (
        isExpenseReport(iouReport) &&
        iouReport?.stateNum !== undefined &&
        iouReport?.statusNum !== undefined &&
        iouReport?.policyID === policyID &&
        iouReport?.stateNum <= CONST.REPORT.STATE_NUM.SUBMITTED &&
        iouReport?.statusNum <= CONST.REPORT.STATUS_NUM.SUBMITTED &&
        !hasForwardedAction(iouReport.reportID) &&
        !isArchivedReport(reportNameValuePair)
    );
}

/**
 * Get outstanding expense reports for a given policy ID
 * @param policyID - The policy ID to filter reports by
 * @param reportOwnerAccountID - The accountID of the report owner
 * @param reports - Collection of reports to filter
 * @returns Array of outstanding expense reports sorted by name
 */
function getOutstandingReportsForUser(
    policyID: string | undefined,
    reportOwnerAccountID: number | undefined,
    reports: OnyxCollection<Report> = allReports,
    reportNameValuePairs: OnyxCollection<ReportNameValuePairs> = allReportNameValuePair,
): Array<OnyxEntry<Report>> {
    if (!reports) {
        return [];
    }
    return Object.values(reports)
        .filter(
            (report) =>
                report?.pendingFields?.preview !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE &&
                isReportOutstanding(report, policyID, reportNameValuePairs) &&
                report?.ownerAccountID === reportOwnerAccountID,
        )
        .sort((a, b) => localeCompare(a?.reportName?.toLowerCase() ?? '', b?.reportName?.toLowerCase() ?? ''));
}

/**
 * Sort outstanding reports by their name, while keeping the selected one at the beginning.
 * @param report1 Details of the first report to be compared.
 * @param report2 Details of the second report to be compared.
 * @param selectedReportID ID of the selected report which needs to be at the beginning.
 */
function sortOutstandingReportsBySelected(report1: OnyxEntry<Report>, report2: OnyxEntry<Report>, selectedReportID: string | undefined): number {
    if (report1?.reportID === selectedReportID) {
        return -1;
    }
    if (report2?.reportID === selectedReportID) {
        return 1;
    }
    return localeCompare(report1?.reportName?.toLowerCase() ?? '', report2?.reportName?.toLowerCase() ?? '');
}

/**
 * @returns the object to update `report.hasOutstandingChildRequest`
 */
function getOutstandingChildRequest(iouReport: OnyxInputOrEntry<Report>): OutstandingChildRequest {
    if (!iouReport || isEmptyObject(iouReport)) {
        return {};
    }

    if (!isExpenseReport(iouReport)) {
        const {reimbursableSpend} = getMoneyRequestSpendBreakdown(iouReport);
        return {
            hasOutstandingChildRequest: iouReport.managerID === currentUserAccountID && reimbursableSpend !== 0,
        };
    }

    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(iouReport.policyID);
    const shouldBeManuallySubmitted = isPaidGroupPolicyPolicyUtils(policy) && !policy?.harvesting?.enabled;
    if (shouldBeManuallySubmitted) {
        return {
            hasOutstandingChildRequest: true,
        };
    }

    // We don't need to update hasOutstandingChildRequest in this case
    return {};
}

function canReportBeMentionedWithinPolicy(report: OnyxEntry<Report>, policyID: string | undefined): boolean {
    if (!policyID || report?.policyID !== policyID) {
        return false;
    }

    return isChatRoom(report) && !isInvoiceRoom(report) && !isThread(report);
}

function prepareOnboardingOnyxData(
    introSelected: OnyxEntry<IntroSelected>,
    engagementChoice: OnboardingPurpose,
    onboardingMessage: OnboardingMessage,
    adminsChatReportID?: string,
    onboardingPolicyID?: string,
    userReportedIntegration?: OnboardingAccounting,
    wasInvited?: boolean,
    companySize?: OnboardingCompanySize,
) {
    if (engagementChoice === CONST.ONBOARDING_CHOICES.PERSONAL_SPEND) {
        // eslint-disable-next-line no-param-reassign
        onboardingMessage = getOnboardingMessages().onboardingMessages[CONST.ONBOARDING_CHOICES.PERSONAL_SPEND];
    }

    if (engagementChoice === CONST.ONBOARDING_CHOICES.EMPLOYER || engagementChoice === CONST.ONBOARDING_CHOICES.SUBMIT) {
        // eslint-disable-next-line no-param-reassign
        onboardingMessage = getOnboardingMessages().onboardingMessages[CONST.ONBOARDING_CHOICES.SUBMIT];
    }

    // Guides are assigned and tasks are posted in the #admins room for the MANAGE_TEAM and TRACK_WORKSPACE onboarding actions, except for emails that have a '+'.
    type PostTasksInAdminsRoomOnboardingChoices = 'newDotManageTeam' | 'newDotTrackWorkspace';
    const shouldPostTasksInAdminsRoom =
        [CONST.ONBOARDING_CHOICES.MANAGE_TEAM, CONST.ONBOARDING_CHOICES.TRACK_WORKSPACE].includes(engagementChoice as PostTasksInAdminsRoomOnboardingChoices) &&
        !currentUserEmail?.includes('+');
    const adminsChatReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${adminsChatReportID}`];
    const targetChatReport = shouldPostTasksInAdminsRoom
        ? (adminsChatReport ?? {reportID: adminsChatReportID, policyID: onboardingPolicyID})
        : getChatByParticipants([CONST.ACCOUNT_ID.CONCIERGE, currentUserAccountID ?? CONST.DEFAULT_NUMBER_ID], allReports, false, true);
    const {reportID: targetChatReportID = '', policyID: targetChatPolicyID = ''} = targetChatReport ?? {};

    if (!targetChatReportID) {
        Log.warn('Missing reportID for onboarding optimistic data');
        return;
    }

    const integrationName = userReportedIntegration ? CONST.ONBOARDING_ACCOUNTING_MAPPING[userReportedIntegration as keyof typeof CONST.ONBOARDING_ACCOUNTING_MAPPING] : '';
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const assignedGuideEmail = getPolicy(targetChatPolicyID)?.assignedGuide?.email ?? 'Setup Specialist';
    const assignedGuidePersonalDetail = Object.values(allPersonalDetails ?? {}).find((personalDetail) => personalDetail?.login === assignedGuideEmail);
    let assignedGuideAccountID: number;
    if (assignedGuidePersonalDetail && assignedGuidePersonalDetail.accountID) {
        assignedGuideAccountID = assignedGuidePersonalDetail.accountID;
    } else {
        assignedGuideAccountID = generateAccountID(assignedGuideEmail);
        // eslint-disable-next-line rulesdir/prefer-actions-set-data
        Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, {
            [assignedGuideAccountID]: {
                isOptimisticPersonalDetail: assignedGuideEmail === CONST.SETUP_SPECIALIST_LOGIN,
                login: assignedGuideEmail,
                displayName: assignedGuideEmail,
            },
        });
    }
    const actorAccountID = shouldPostTasksInAdminsRoom ? assignedGuideAccountID : CONST.ACCOUNT_ID.CONCIERGE;
    const firstAdminPolicy = getActivePolicies(allPolicies, currentUserEmail).find(
        (policy) => policy.type !== CONST.POLICY.TYPE.PERSONAL && getPolicyRole(policy, currentUserEmail) === CONST.POLICY.ROLE.ADMIN,
    );

    let testDriveURL: string;
    if (([CONST.ONBOARDING_CHOICES.MANAGE_TEAM, CONST.ONBOARDING_CHOICES.TEST_DRIVE_RECEIVER, CONST.ONBOARDING_CHOICES.TRACK_WORKSPACE] as OnboardingPurpose[]).includes(engagementChoice)) {
        testDriveURL = ROUTES.TEST_DRIVE_DEMO_ROOT;
    } else if (introSelected?.choice === CONST.ONBOARDING_CHOICES.SUBMIT && introSelected.inviteType === CONST.ONBOARDING_INVITE_TYPES.WORKSPACE) {
        testDriveURL = ROUTES.TEST_DRIVE_DEMO_ROOT;
    } else {
        testDriveURL = ROUTES.TEST_DRIVE_MODAL_ROOT.route;
    }

    const onboardingTaskParams: OnboardingTaskLinks = {
        integrationName,
        onboardingCompanySize: companySize ?? onboardingCompanySize,
        workspaceSettingsLink: `${environmentURL}/${ROUTES.WORKSPACE_INITIAL.getRoute(onboardingPolicyID ?? firstAdminPolicy?.id)}`,
        workspaceCategoriesLink: `${environmentURL}/${ROUTES.WORKSPACE_CATEGORIES.getRoute(onboardingPolicyID)}`,
        workspaceMembersLink: `${environmentURL}/${ROUTES.WORKSPACE_MEMBERS.getRoute(onboardingPolicyID)}`,
        workspaceMoreFeaturesLink: `${environmentURL}/${ROUTES.WORKSPACE_MORE_FEATURES.getRoute(onboardingPolicyID)}`,
        workspaceConfirmationLink: `${environmentURL}/${ROUTES.WORKSPACE_CONFIRMATION.getRoute(ROUTES.WORKSPACES_LIST.route)}`,
        testDriveURL: `${environmentURL}/${testDriveURL}`,
        workspaceAccountingLink: `${environmentURL}/${ROUTES.POLICY_ACCOUNTING.getRoute(onboardingPolicyID)}`,
        corporateCardLink: `${environmentURL}/${ROUTES.WORKSPACE_COMPANY_CARDS.getRoute(onboardingPolicyID)}`,
    };

    // Text message
    const message = typeof onboardingMessage.message === 'function' ? onboardingMessage.message(onboardingTaskParams) : onboardingMessage.message;
    const textComment = buildOptimisticAddCommentReportAction(message, undefined, actorAccountID, 1);
    const textCommentAction: OptimisticAddCommentReportAction = textComment.reportAction;
    const textMessage: AddCommentOrAttachmentParams = {
        reportID: targetChatReportID,
        reportActionID: textCommentAction.reportActionID,
        reportComment: textComment.commentText,
    };

    let createWorkspaceTaskReportID;
    const tasksData = onboardingMessage.tasks
        .filter((task) => {
            if (['setupCategories', 'setupTags'].includes(task.type) && userReportedIntegration) {
                return false;
            }

            if (['addAccountingIntegration', 'setupCategoriesAndTags'].includes(task.type) && !userReportedIntegration) {
                return false;
            }
            type SkipViewTourOnboardingChoices = 'newDotSubmit' | 'newDotSplitChat' | 'newDotPersonalSpend' | 'newDotEmployer';
            if (
                task.type === 'viewTour' &&
                [
                    CONST.ONBOARDING_CHOICES.EMPLOYER,
                    CONST.ONBOARDING_CHOICES.PERSONAL_SPEND,
                    CONST.ONBOARDING_CHOICES.SUBMIT,
                    CONST.ONBOARDING_CHOICES.CHAT_SPLIT,
                    CONST.ONBOARDING_CHOICES.MANAGE_TEAM,
                ].includes(introSelected?.choice as SkipViewTourOnboardingChoices) &&
                engagementChoice === CONST.ONBOARDING_CHOICES.MANAGE_TEAM
            ) {
                return false;
            }

            // Exclude createWorkspace and viewTour tasks from #admin room, for test drive receivers,
            // since these users already have them in concierge
            if (introSelected?.choice === CONST.ONBOARDING_CHOICES.TEST_DRIVE_RECEIVER && ['createWorkspace', 'viewTour'].includes(task.type) && shouldPostTasksInAdminsRoom) {
                return false;
            }

            return true;
        })
        .map((task, index) => {
            const taskDescription = typeof task.description === 'function' ? task.description(onboardingTaskParams) : task.description;
            const taskTitle = typeof task.title === 'function' ? task.title(onboardingTaskParams) : task.title;
            const currentTask = buildOptimisticTaskReport(
                actorAccountID,
                targetChatReportID,
                currentUserAccountID,
                taskTitle,
                taskDescription,
                targetChatPolicyID,
                CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN,
                task.mediaAttributes,
            );
            const emailCreatingAction =
                engagementChoice === CONST.ONBOARDING_CHOICES.MANAGE_TEAM ? (allPersonalDetails?.[actorAccountID]?.login ?? CONST.EMAIL.CONCIERGE) : CONST.EMAIL.CONCIERGE;
            const taskCreatedAction = buildOptimisticCreatedReportAction(emailCreatingAction);
            const taskReportAction = buildOptimisticTaskCommentReportAction(currentTask.reportID, taskTitle, 0, `task for ${taskTitle}`, targetChatReportID, actorAccountID, index + 3);
            currentTask.parentReportActionID = taskReportAction.reportAction.reportActionID;

            const completedTaskReportAction = task.autoCompleted
                ? buildOptimisticTaskReportAction(currentTask.reportID, CONST.REPORT.ACTIONS.TYPE.TASK_COMPLETED, 'marked as complete', actorAccountID, 2)
                : null;
            if (task.type === 'createWorkspace') {
                createWorkspaceTaskReportID = currentTask.reportID;
            }

            return {
                task,
                currentTask,
                taskCreatedAction,
                taskReportAction,
                taskDescription: currentTask.description,
                completedTaskReportAction,
            };
        });

    // Sign-off welcome message
    const welcomeSignOffText =
        engagementChoice === CONST.ONBOARDING_CHOICES.MANAGE_TEAM ? translateLocal('onboarding.welcomeSignOffTitleManageTeam') : translateLocal('onboarding.welcomeSignOffTitle');
    const welcomeSignOffComment = buildOptimisticAddCommentReportAction(welcomeSignOffText, undefined, actorAccountID, tasksData.length + 3);
    const welcomeSignOffCommentAction: OptimisticAddCommentReportAction = welcomeSignOffComment.reportAction;
    const welcomeSignOffMessage = {
        reportID: targetChatReportID,
        reportActionID: welcomeSignOffCommentAction.reportActionID,
        reportComment: welcomeSignOffComment.commentText,
    };

    const tasksForParameters = tasksData.map<TaskForParameters>(({task, currentTask, taskCreatedAction, taskReportAction, taskDescription, completedTaskReportAction}) => ({
        type: 'task',
        task: task.type,
        taskReportID: currentTask.reportID,
        parentReportID: currentTask.parentReportID,
        parentReportActionID: taskReportAction.reportAction.reportActionID,
        createdTaskReportActionID: taskCreatedAction.reportActionID,
        completedTaskReportActionID: completedTaskReportAction?.reportActionID,
        title: currentTask.reportName ?? '',
        description: taskDescription ?? '',
    }));

    const hasOutstandingChildTask = tasksData.some((task) => !task.completedTaskReportAction);

    const tasksForOptimisticData = tasksData.reduce<OnyxUpdate[]>((acc, {currentTask, taskCreatedAction, taskReportAction, taskDescription, completedTaskReportAction}) => {
        acc.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetChatReportID}`,
                value: {
                    [taskReportAction.reportAction.reportActionID]: taskReportAction.reportAction as ReportAction,
                },
            },
            {
                onyxMethod: Onyx.METHOD.SET,
                key: `${ONYXKEYS.COLLECTION.REPORT}${currentTask.reportID}`,
                value: {
                    ...currentTask,
                    description: taskDescription,
                    pendingFields: {
                        createChat: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                        reportName: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                        description: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                        managerID: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    },
                    managerID: currentUserAccountID,
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${currentTask.reportID}`,
                value: {
                    isOptimisticReport: true,
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${currentTask.reportID}`,
                value: {
                    [taskCreatedAction.reportActionID]: taskCreatedAction as ReportAction,
                },
            },
        );

        if (completedTaskReportAction) {
            acc.push({
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${currentTask.reportID}`,
                value: {
                    [completedTaskReportAction.reportActionID]: completedTaskReportAction as ReportAction,
                },
            });

            acc.push({
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${currentTask.reportID}`,
                value: {
                    stateNum: CONST.REPORT.STATE_NUM.APPROVED,
                    statusNum: CONST.REPORT.STATUS_NUM.APPROVED,
                    managerID: currentUserAccountID,
                },
            });
        }

        return acc;
    }, []);

    const tasksForFailureData = tasksData.reduce<OnyxUpdate[]>((acc, {currentTask, taskReportAction}) => {
        acc.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetChatReportID}`,
                value: {
                    [taskReportAction.reportAction.reportActionID]: {
                        errors: getMicroSecondOnyxErrorWithTranslationKey('report.genericAddCommentFailureMessage'),
                    } as ReportAction,
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${currentTask.reportID}`,
                value: null,
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${currentTask.reportID}`,
                value: null,
            },
        );

        return acc;
    }, []);

    const tasksForSuccessData = tasksData.reduce<OnyxUpdate[]>((acc, {currentTask, taskCreatedAction, taskReportAction, completedTaskReportAction}) => {
        acc.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetChatReportID}`,
                value: {
                    [taskReportAction.reportAction.reportActionID]: {pendingAction: null, isOptimisticAction: null},
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${currentTask.reportID}`,
                value: {
                    pendingFields: {
                        createChat: null,
                        reportName: null,
                        description: null,
                        managerID: null,
                    },
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${currentTask.reportID}`,
                value: {
                    isOptimisticReport: false,
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${currentTask.reportID}`,
                value: {
                    [taskCreatedAction.reportActionID]: {pendingAction: null},
                },
            },
        );

        if (completedTaskReportAction) {
            acc.push({
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${currentTask.reportID}`,
                value: {
                    [completedTaskReportAction.reportActionID]: {pendingAction: null, isOptimisticAction: null},
                },
            });
        }

        return acc;
    }, []);

    const optimisticData: OnyxUpdate[] = [...tasksForOptimisticData];
    const lastVisibleActionCreated = welcomeSignOffCommentAction.created;
    optimisticData.push(
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${targetChatReportID}`,
            value: {
                hasOutstandingChildTask,
                lastVisibleActionCreated,
                lastActorAccountID: actorAccountID,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.NVP_INTRO_SELECTED,
            value: {
                choice: engagementChoice,
                createWorkspace: createWorkspaceTaskReportID,
            },
        },
    );

    // If we post tasks in the #admins room and introSelected?.choice does not exist, it means that a guide is assigned and all messages except tasks are handled by the backend
    if (!shouldPostTasksInAdminsRoom || !!introSelected?.choice) {
        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetChatReportID}`,
            value: {
                [textCommentAction.reportActionID]: textCommentAction as ReportAction,
            },
        });
    }

    if (!wasInvited) {
        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.NVP_ONBOARDING,
            value: {hasCompletedGuidedSetupFlow: true},
        });
    }

    const successData: OnyxUpdate[] = [...tasksForSuccessData];

    // If we post tasks in the #admins room and introSelected?.choice does not exist, it means that a guide is assigned and all messages except tasks are handled by the backend
    if (!shouldPostTasksInAdminsRoom || !!introSelected?.choice) {
        successData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetChatReportID}`,
            value: {
                [textCommentAction.reportActionID]: {pendingAction: null, isOptimisticAction: null},
            },
        });
    }

    let failureReport: Partial<Report> = {
        lastMessageText: '',
        lastVisibleActionCreated: '',
        hasOutstandingChildTask: false,
    };
    const report = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${targetChatReportID}`];
    const canUserPerformWriteAction1 = canUserPerformWriteAction(report);
    const {lastMessageText = ''} = getLastVisibleMessageActionUtils(targetChatReportID, canUserPerformWriteAction1);
    if (lastMessageText) {
        const lastVisibleAction = getLastVisibleAction(targetChatReportID, canUserPerformWriteAction1);
        const prevLastVisibleActionCreated = lastVisibleAction?.created;
        const lastActorAccountID = lastVisibleAction?.actorAccountID;
        failureReport = {
            lastMessageText,
            lastVisibleActionCreated: prevLastVisibleActionCreated,
            lastActorAccountID,
        };
    }

    const failureData: OnyxUpdate[] = [...tasksForFailureData];
    failureData.push(
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${targetChatReportID}`,
            value: failureReport,
        },

        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.NVP_INTRO_SELECTED,
            value: {
                choice: null,
                createWorkspace: null,
            },
        },
    );
    // If we post tasks in the #admins room and introSelected?.choice does not exist, it means that a guide is assigned and all messages except tasks are handled by the backend
    if (!shouldPostTasksInAdminsRoom || !!introSelected?.choice) {
        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetChatReportID}`,
            value: {
                [textCommentAction.reportActionID]: {
                    errors: getMicroSecondOnyxErrorWithTranslationKey('report.genericAddCommentFailureMessage'),
                } as ReportAction,
            },
        });
    }

    if (!wasInvited) {
        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.NVP_ONBOARDING,
            value: {hasCompletedGuidedSetupFlow: onboarding?.hasCompletedGuidedSetupFlow ?? null},
        });
    }

    if (userReportedIntegration) {
        const requiresControlPlan: AllConnectionName[] = [CONST.POLICY.CONNECTIONS.NAME.NETSUITE, CONST.POLICY.CONNECTIONS.NAME.QBD, CONST.POLICY.CONNECTIONS.NAME.SAGE_INTACCT];

        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${onboardingPolicyID}`,
            value: {
                areConnectionsEnabled: true,
                ...(requiresControlPlan.includes(userReportedIntegration as AllConnectionName)
                    ? {
                          type: CONST.POLICY.TYPE.CORPORATE,
                      }
                    : {}),
                pendingFields: {
                    areConnectionsEnabled: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                },
            },
        });
        successData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${onboardingPolicyID}`,
            value: {
                pendingFields: {
                    areConnectionsEnabled: null,
                },
            },
        });
        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${onboardingPolicyID}`,
            value: {
                // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
                // eslint-disable-next-line deprecation/deprecation
                areConnectionsEnabled: getPolicy(onboardingPolicyID)?.areConnectionsEnabled,
                pendingFields: {
                    areConnectionsEnabled: null,
                },
            },
        });
    }

    // If we post tasks in the #admins room and introSelected?.choice does not exist, it means that a guide is assigned and all messages except tasks are handled by the backend
    const guidedSetupData: GuidedSetupData = [];

    if (!shouldPostTasksInAdminsRoom || !!introSelected?.choice) {
        guidedSetupData.push({type: 'message', ...textMessage});
    }

    let selfDMParameters: SelfDMParameters = {};
    if (engagementChoice === CONST.ONBOARDING_CHOICES.PERSONAL_SPEND) {
        const selfDMReportID = findSelfDMReportID();
        let selfDMReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${selfDMReportID}`];
        let createdAction: ReportAction;
        if (!selfDMReport) {
            const currentTime = DateUtils.getDBTime();
            selfDMReport = buildOptimisticSelfDMReport(currentTime);
            createdAction = buildOptimisticCreatedReportAction(currentUserEmail ?? '', currentTime);
            selfDMParameters = {reportID: selfDMReport.reportID, createdReportActionID: createdAction.reportActionID};
            optimisticData.push(
                {
                    onyxMethod: Onyx.METHOD.SET,
                    key: `${ONYXKEYS.COLLECTION.REPORT}${selfDMReport.reportID}`,
                    value: {
                        ...selfDMReport,
                        pendingFields: {
                            createChat: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                        },
                    },
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${selfDMReport.reportID}`,
                    value: {
                        isOptimisticReport: true,
                    },
                },
                {
                    onyxMethod: Onyx.METHOD.SET,
                    key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${selfDMReport.reportID}`,
                    value: {
                        [createdAction.reportActionID]: createdAction,
                    },
                },
            );

            successData.push(
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT}${selfDMReport.reportID}`,
                    value: {
                        pendingFields: {
                            createChat: null,
                        },
                    },
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${selfDMReport.reportID}`,
                    value: {
                        isOptimisticReport: false,
                    },
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${selfDMReport.reportID}`,
                    value: {
                        [createdAction.reportActionID]: {
                            pendingAction: null,
                        },
                    },
                },
            );
        }
    }

    guidedSetupData.push(...tasksForParameters);

    if (!introSelected?.choice || introSelected.choice === CONST.ONBOARDING_CHOICES.TEST_DRIVE_RECEIVER) {
        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetChatReportID}`,
            value: {
                [welcomeSignOffCommentAction.reportActionID]: welcomeSignOffCommentAction as ReportAction,
            },
        });

        successData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetChatReportID}`,
            value: {
                [welcomeSignOffCommentAction.reportActionID]: {pendingAction: null, isOptimisticAction: null},
            },
        });

        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetChatReportID}`,
            value: {
                [welcomeSignOffCommentAction.reportActionID]: {
                    errors: getMicroSecondOnyxErrorWithTranslationKey('report.genericAddCommentFailureMessage'),
                } as ReportAction,
            },
        });
        guidedSetupData.push({type: 'message', ...welcomeSignOffMessage});
    }

    return {optimisticData, successData, failureData, guidedSetupData, actorAccountID, selfDMParameters};
}

/**
 * Whether a given report is used for onboarding tasks. In the past, it could be either the Concierge chat or the system
 * DM, and we saved the report ID in the user's `onboarding` NVP. As a fallback for users who don't have the NVP, we now
 * only use the Concierge chat.
 */
function isChatUsedForOnboarding(optionOrReport: OnyxEntry<Report> | OptionData, onboardingPurposeSelected?: OnboardingPurpose): boolean {
    // onboarding can be an empty object for old accounts and accounts created from olddot
    if (onboarding && !isEmptyObject(onboarding) && onboarding.chatReportID) {
        return onboarding.chatReportID === optionOrReport?.reportID;
    }
    if (isEmptyObject(onboarding)) {
        return (optionOrReport as OptionData)?.isConciergeChat ?? isConciergeChatReport(optionOrReport);
    }

    // Onboarding guides are assigned to signup with emails that do not contain a '+' and select the "Manage my team's expenses" intent.
    // Guides and onboarding tasks are posted to the #admins room to facilitate the onboarding process.
    return onboardingPurposeSelected === CONST.ONBOARDING_CHOICES.MANAGE_TEAM && !currentUserEmail?.includes('+')
        ? isAdminRoom(optionOrReport)
        : ((optionOrReport as OptionData)?.isConciergeChat ?? isConciergeChatReport(optionOrReport));
}

/**
 * Get the report used for the user's onboarding process. For most users it is the Concierge chat, however in the past
 * we also used the system DM for A/B tests.
 */
function getChatUsedForOnboarding(): OnyxEntry<Report> {
    return Object.values(allReports ?? {}).find((report) => isChatUsedForOnboarding(report));
}

/**
 * Checks if given field has any violations and returns name of the first encountered one
 */
function getFieldViolation(violations: OnyxEntry<ReportViolations>, reportField: PolicyReportField): ReportViolationName | undefined {
    if (!violations || !reportField) {
        return undefined;
    }

    return Object.values(CONST.REPORT_VIOLATIONS).find((violation) => !!violations[violation] && violations[violation][reportField.fieldID]);
}

/**
 * Returns translation for given field violation
 */
function getFieldViolationTranslation(reportField: PolicyReportField, violation?: ReportViolationName): string {
    if (!violation) {
        return '';
    }

    switch (violation) {
        case 'fieldRequired':
            return translateLocal('reportViolations.fieldRequired', {fieldName: reportField.name});
        default:
            return '';
    }
}

/**
 * Returns all violations for report
 */
function getReportViolations(reportID: string): ReportViolations | undefined {
    if (!allReportsViolations) {
        return undefined;
    }

    return allReportsViolations[`${ONYXKEYS.COLLECTION.REPORT_VIOLATIONS}${reportID}`];
}

function findPolicyExpenseChatByPolicyID(policyID: string): OnyxEntry<Report> {
    return Object.values(allReports ?? {}).find((report) => isPolicyExpenseChat(report) && report?.policyID === policyID);
}

/**
 * A function to get the report last message. This is usually used to restore the report message preview in LHN after report actions change.
 * @param reportID
 * @param actionsToMerge
 * @param canUserPerformWriteActionInReport
 * @returns containing the calculated message preview data of the report
 */
function getReportLastMessage(reportID: string, actionsToMerge?: ReportActions) {
    let result: Partial<Report> = {
        lastMessageText: '',
        lastVisibleActionCreated: '',
    };

    const {lastMessageText = ''} = getLastVisibleMessage(reportID, actionsToMerge);

    if (lastMessageText) {
        const report = getReport(reportID, allReports);
        const lastVisibleAction = getLastVisibleActionReportActionsUtils(reportID, canUserPerformWriteAction(report), actionsToMerge);
        const lastVisibleActionCreated = lastVisibleAction?.created;
        const lastActorAccountID = lastVisibleAction?.actorAccountID;
        result = {
            lastMessageText,
            lastVisibleActionCreated,
            lastActorAccountID,
        };
    }

    return result;
}

function getReportLastVisibleActionCreated(report: OnyxEntry<Report>, oneTransactionThreadReport: OnyxEntry<Report>) {
    const reportLastVisibleActionCreated = report?.lastVisibleActionCreated ?? '';
    const threadLastVisibleActionCreated = oneTransactionThreadReport?.lastVisibleActionCreated ?? '';
    return reportLastVisibleActionCreated > threadLastVisibleActionCreated ? reportLastVisibleActionCreated : threadLastVisibleActionCreated;
}

function getSourceIDFromReportAction(reportAction: OnyxEntry<ReportAction>): string {
    const message = Array.isArray(reportAction?.message) ? (reportAction?.message?.at(-1) ?? null) : (reportAction?.message ?? null);
    const html = message?.html ?? '';
    const {sourceURL} = getAttachmentDetails(html);
    const sourceID = (sourceURL?.match(CONST.REGEX.ATTACHMENT_ID) ?? [])[1];
    return sourceID;
}

function getIntegrationIcon(connectionName?: ConnectionName) {
    if (connectionName === CONST.POLICY.CONNECTIONS.NAME.XERO) {
        return XeroSquare;
    }
    if (connectionName === CONST.POLICY.CONNECTIONS.NAME.QBO) {
        return QBOSquare;
    }
    if (connectionName === CONST.POLICY.CONNECTIONS.NAME.NETSUITE) {
        return NetSuiteSquare;
    }
    if (connectionName === CONST.POLICY.CONNECTIONS.NAME.SAGE_INTACCT) {
        return IntacctSquare;
    }
    if (connectionName === CONST.POLICY.CONNECTIONS.NAME.QBD) {
        return QBDSquare;
    }

    return undefined;
}

function getIntegrationExportIcon(connectionName?: ConnectionName) {
    if (connectionName === CONST.POLICY.CONNECTIONS.NAME.XERO) {
        return XeroExport;
    }
    if (connectionName === CONST.POLICY.CONNECTIONS.NAME.QBO || connectionName === CONST.POLICY.CONNECTIONS.NAME.QBD) {
        return QBOExport;
    }
    if (connectionName === CONST.POLICY.CONNECTIONS.NAME.NETSUITE) {
        return NetSuiteExport;
    }
    if (connectionName === CONST.POLICY.CONNECTIONS.NAME.SAGE_INTACCT) {
        return SageIntacctExport;
    }

    return undefined;
}

function canBeExported(report: OnyxEntry<Report>) {
    if (!report?.statusNum) {
        return false;
    }
    const isCorrectState = [CONST.REPORT.STATUS_NUM.APPROVED, CONST.REPORT.STATUS_NUM.CLOSED, CONST.REPORT.STATUS_NUM.REIMBURSED].some((status) => status === report.statusNum);
    return isExpenseReport(report) && isCorrectState;
}

function getIntegrationNameFromExportMessage(reportActions: OnyxEntry<ReportActions> | ReportAction[]) {
    if (!reportActions) {
        return '';
    }

    if (Array.isArray(reportActions)) {
        const exportIntegrationAction = reportActions.find((action) => isExportIntegrationAction(action));
        if (!exportIntegrationAction || !isExportIntegrationAction(exportIntegrationAction)) {
            return null;
        }

        const originalMessage = (getOriginalMessage(exportIntegrationAction) ?? {}) as OriginalMessageExportIntegration;
        const {label} = originalMessage;
        return label ?? null;
    }
}

function isExported(reportActions: OnyxEntry<ReportActions> | ReportAction[]) {
    if (!reportActions) {
        return false;
    }

    let exportIntegrationActionsCount = 0;
    let integrationMessageActionsCount = 0;

    const reportActionList = Array.isArray(reportActions) ? reportActions : Object.values(reportActions);
    for (const action of reportActionList) {
        if (isExportIntegrationAction(action)) {
            // We consider any reports marked manually as exported to be exported, so we shortcut here.
            if (getOriginalMessage(action)?.markedManually) {
                return true;
            }
            exportIntegrationActionsCount++;
        }
        if (isIntegrationMessageAction(action)) {
            integrationMessageActionsCount++;
        }
    }

    // We need to make sure that there was at least one successful export to consider the report exported.
    // We add one EXPORT_INTEGRATION action to the report when we start exporting it (with pendingAction: 'add') and then another EXPORT_INTEGRATION when the export finishes successfully.
    // If the export fails, we add an INTEGRATIONS_MESSAGE action to the report, but the initial EXPORT_INTEGRATION action is still present, so we compare the counts of these two actions to determine if the report was exported successfully.
    return exportIntegrationActionsCount > integrationMessageActionsCount;
}

function hasExportError(reportActions: OnyxEntry<ReportActions> | ReportAction[]) {
    if (!reportActions) {
        return false;
    }

    if (Array.isArray(reportActions)) {
        return reportActions.some((action) => isIntegrationMessageAction(action));
    }

    return Object.values(reportActions).some((action) => isIntegrationMessageAction(action));
}

function doesReportContainRequestsFromMultipleUsers(iouReport: OnyxEntry<Report>): boolean {
    const transactions = getReportTransactions(iouReport?.reportID);
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    return isIOUReport(iouReport) && transactions.some((transaction) => (transaction?.modifiedAmount || transaction?.amount) < 0);
}

/**
 * Determines whether the report can be moved to the workspace.
 */
function isWorkspaceEligibleForReportChange(newPolicy: OnyxEntry<Policy>, report: OnyxEntry<Report>, policies: OnyxCollection<Policy>): boolean {
    const submitterEmail = getLoginByAccountID(report?.ownerAccountID ?? CONST.DEFAULT_NUMBER_ID);
    const managerLogin = getLoginByAccountID(report?.managerID ?? CONST.DEFAULT_NUMBER_ID);
    // We can't move the iou report to the workspace if both users from the iou report create the expense
    if (doesReportContainRequestsFromMultipleUsers(report)) {
        return false;
    }

    if (!newPolicy?.isPolicyExpenseChatEnabled) {
        return false;
    }

    // We can only move the iou report to the workspace if the manager is the payer of the new policy
    if (isIOUReport(report)) {
        return isPaidGroupPolicyPolicyUtils(newPolicy) && isWorkspacePayer(managerLogin ?? '', newPolicy);
    }
    return isPaidGroupPolicyPolicyUtils(newPolicy) && (isPolicyMember(submitterEmail, newPolicy?.id) || isPolicyAdmin(newPolicy?.id, policies));
}

function getApprovalChain(policy: OnyxEntry<Policy>, expenseReport: OnyxEntry<Report>): string[] {
    const approvalChain: string[] = [];
    const fullApprovalChain: string[] = [];
    const reportTotal = expenseReport?.total ?? 0;
    const submitterEmail = getLoginsByAccountIDs([expenseReport?.ownerAccountID ?? CONST.DEFAULT_NUMBER_ID]).at(0) ?? '';

    if (isSubmitAndClose(policy)) {
        return approvalChain;
    }

    // Get category/tag approver list
    const ruleApprovers = getRuleApprovers(policy, expenseReport);

    // Push rule approvers to approvalChain list before submitsTo/forwardsTo approvers
    ruleApprovers.forEach((ruleApprover) => {
        // Don't push submitter to approve as a rule approver
        if (fullApprovalChain.includes(ruleApprover) || ruleApprover === submitterEmail) {
            return;
        }
        fullApprovalChain.push(ruleApprover);
    });

    let nextApproverEmail = getManagerAccountEmail(policy, expenseReport);

    while (nextApproverEmail && !approvalChain.includes(nextApproverEmail)) {
        approvalChain.push(nextApproverEmail);
        nextApproverEmail = getForwardsToAccount(policy, nextApproverEmail, reportTotal);
    }

    approvalChain.forEach((approver) => {
        if (fullApprovalChain.includes(approver)) {
            return;
        }

        fullApprovalChain.push(approver);
    });

    if (fullApprovalChain.at(-1) === submitterEmail && policy?.preventSelfApproval) {
        fullApprovalChain.pop();
    }
    return fullApprovalChain;
}

/**
 * Checks if the user has missing bank account for the invoice room.
 */
function hasMissingInvoiceBankAccount(iouReportID: string | undefined): boolean {
    if (!iouReportID) {
        return false;
    }

    const invoiceReport = getReport(iouReportID, allReports);

    if (!isInvoiceReport(invoiceReport)) {
        return false;
    }

    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    return invoiceReport?.ownerAccountID === currentUserAccountID && !getPolicy(invoiceReport?.policyID)?.invoice?.bankAccount?.transferBankAccountID && isSettled(iouReportID);
}

function hasInvoiceReports() {
    const reports = Object.values(allReports ?? {});
    return reports.some((report) => isInvoiceReport(report));
}

function shouldUnmaskChat(participantsContext: OnyxEntry<PersonalDetailsList>, report: OnyxInputOrEntry<Report>): boolean {
    if (!report?.participants) {
        return true;
    }

    if (isThread(report) && report?.chatType && report?.chatType === CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT) {
        return true;
    }

    if (isThread(report) && report?.type === CONST.REPORT.TYPE.EXPENSE) {
        return true;
    }

    if (isAdminRoom(report)) {
        return true;
    }

    const participantAccountIDs = Object.keys(report.participants);

    if (participantAccountIDs.length > 2) {
        return false;
    }

    if (participantsContext) {
        let teamInChat = false;
        let userInChat = false;

        for (const participantAccountID of participantAccountIDs) {
            const id = Number(participantAccountID);
            const contextAccountData = participantsContext[id];

            if (contextAccountData) {
                const login = contextAccountData.login ?? '';

                if (login.endsWith(CONST.EMAIL.EXPENSIFY_EMAIL_DOMAIN) || login.endsWith(CONST.EMAIL.EXPENSIFY_TEAM_EMAIL_DOMAIN)) {
                    teamInChat = true;
                } else {
                    userInChat = true;
                }
            }
        }

        // exclude teamOnly chat
        if (teamInChat && userInChat) {
            return true;
        }
    }

    return false;
}

function getReportMetadata(reportID: string | undefined) {
    return reportID ? allReportMetadataKeyValue[reportID] : undefined;
}

/**
 * Helper method to check if participant email is Manager McTest
 */
function isSelectedManagerMcTest(email: string | null | undefined): boolean {
    return email === CONST.EMAIL.MANAGER_MCTEST;
}

/**
 *  Helper method to check if the report is a test transaction report
 */
function isTestTransactionReport(report: OnyxEntry<Report>): boolean {
    const managerID = report?.managerID ?? CONST.DEFAULT_NUMBER_ID;
    const personalDetails = allPersonalDetails?.[managerID];
    return isSelectedManagerMcTest(personalDetails?.login);
}

function isWaitingForSubmissionFromCurrentUser(chatReport: OnyxEntry<Report>, policy: OnyxEntry<Policy>) {
    return chatReport?.isOwnPolicyExpenseChat && !policy?.harvesting?.enabled;
}

function getGroupChatDraft() {
    return newGroupChatDraft;
}

function getChatListItemReportName(action: ReportAction & {reportName?: string}, report: SearchReport | undefined): string {
    if (report && isInvoiceReport(report)) {
        const properInvoiceReport = report;
        properInvoiceReport.chatReportID = report.parentReportID;

        return getInvoiceReportName(properInvoiceReport);
    }

    if (action?.reportName) {
        return action.reportName;
    }

    if (report?.reportID) {
        return getReportName(getReport(report?.reportID, allReports));
    }

    return getReportName(report);
}

/**
 * Generates report attributes for a report
 * This function should be called only in reportAttributes.ts
 * DO NOT USE THIS FUNCTION ANYWHERE ELSE
 */
function generateReportAttributes({
    report,
    chatReport,
    reportActions,
    transactionViolations,
    reportNameValuePairs,
}: {
    report: OnyxEntry<Report>;
    chatReport: OnyxEntry<Report>;
    reportActions?: OnyxCollection<ReportActions>;
    transactionViolations: OnyxCollection<TransactionViolation[]>;
    reportNameValuePairs: OnyxCollection<ReportNameValuePairs>;
}) {
    const reportActionsList = reportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report?.reportID}`];
    const parentReportActionsList = reportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report?.parentReportID}`];
    const isReportSettled = isSettled(report);
    const isCurrentUserReportOwner = isReportOwner(report);
    const doesReportHasViolations = hasReportViolations(report?.reportID);
    const hasViolationsToDisplayInLHN = shouldDisplayViolationsRBRInLHN(report, transactionViolations);
    const hasAnyTypeOfViolations = hasViolationsToDisplayInLHN || (!isReportSettled && isCurrentUserReportOwner && doesReportHasViolations);
    const reportErrors = getAllReportErrors(report, reportActionsList);
    const hasErrors = Object.entries(reportErrors ?? {}).length > 0;
    const oneTransactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, reportActionsList);
    const parentReportAction = report?.parentReportActionID ? parentReportActionsList?.[report.parentReportActionID] : undefined;
    const isReportArchived = !!reportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report?.reportID}`]?.private_isArchived;
    const requiresAttention = requiresAttentionFromCurrentUser(report, parentReportAction, isReportArchived);

    return {
        doesReportHasViolations,
        hasViolationsToDisplayInLHN,
        hasAnyViolations: hasAnyTypeOfViolations,
        reportErrors,
        hasErrors,
        oneTransactionThreadReportID,
        parentReportAction,
        requiresAttention,
        isReportArchived,
    };
}

function getReportPersonalDetailsParticipants(report: Report, personalDetailsParam: OnyxEntry<PersonalDetailsList>, reportMetadata: OnyxEntry<ReportMetadata>, isRoomMembersList = false) {
    const chatParticipants = getParticipantsList(report, personalDetailsParam, isRoomMembersList, reportMetadata);
    return {
        chatParticipants,
        personalDetailsParticipants: chatParticipants.reduce<Record<number, PersonalDetails>>((acc, accountID) => {
            const details = personalDetailsParam?.[accountID];
            if (details) {
                acc[accountID] = details;
            }
            return acc;
        }, {}),
    };
}

function findReportIDForAction(action?: ReportAction): string | undefined {
    if (!allReportActions || !action?.reportActionID) {
        return undefined;
    }

    return Object.keys(allReportActions)
        .find((reportActionsKey) => {
            const reportActions = allReportActions?.[reportActionsKey];
            return !!reportActions && !isEmptyObject(reportActions[action.reportActionID]);
        })
        ?.replace(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}`, '');
}

function hasReportBeenReopened(reportActions: OnyxEntry<ReportActions> | ReportAction[]): boolean {
    if (!reportActions) {
        return false;
    }

    const reportActionList = Array.isArray(reportActions) ? reportActions : Object.values(reportActions);
    return reportActionList.some((action) => isReopenedAction(action));
}

function getMoneyReportPreviewName(action: ReportAction, iouReport: OnyxEntry<Report>, isInvoice?: boolean) {
    if (isInvoice && isActionOfType(action, CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW)) {
        const originalMessage = getOriginalMessage(action);
        return originalMessage && translateLocal('iou.invoiceReportName', originalMessage);
    }
    return getReportName(iouReport) || action.childReportName;
}

/**
 * Returns the translated, human-readable status of the report based on its state and status values.
 * The status is determined by the stateNum and statusNum of the report.
 * The mapping is as follows:
 * ========================================
 * State  |  Status  |  What to display?  |
 * 0	  |  0	     |  Draft             |
 * 1	  |  1	     |  Outstanding       |
 * 2	  |  2	     |  Done              |
 * 2	  |  3	     |  Approved          |
 * 2	  |  4	     |  Paid              |
 * 3	  |  4	     |  Paid              |
 * 6      |  4	     |  Paid              |
 * ========================================
 */
function getReportStatusTranslation(stateNum?: number, statusNum?: number): string {
    if (stateNum === undefined || statusNum === undefined) {
        return '';
    }

    if (stateNum === CONST.REPORT.STATE_NUM.OPEN && statusNum === CONST.REPORT.STATUS_NUM.OPEN) {
        return translateLocal('common.draft');
    }
    if (stateNum === CONST.REPORT.STATE_NUM.SUBMITTED && statusNum === CONST.REPORT.STATUS_NUM.SUBMITTED) {
        return translateLocal('common.outstanding');
    }
    if (stateNum === CONST.REPORT.STATE_NUM.APPROVED && statusNum === CONST.REPORT.STATUS_NUM.CLOSED) {
        return translateLocal('common.done');
    }
    if (stateNum === CONST.REPORT.STATE_NUM.APPROVED && statusNum === CONST.REPORT.STATUS_NUM.APPROVED) {
        return translateLocal('iou.approved');
    }
    if (
        (stateNum === CONST.REPORT.STATE_NUM.APPROVED && statusNum === CONST.REPORT.STATUS_NUM.REIMBURSED) ||
        (stateNum === CONST.REPORT.STATE_NUM.BILLING && statusNum === CONST.REPORT.STATUS_NUM.REIMBURSED) ||
        (stateNum === CONST.REPORT.STATE_NUM.AUTOREIMBURSED && statusNum === CONST.REPORT.STATUS_NUM.REIMBURSED)
    ) {
        return translateLocal('iou.settledExpensify');
    }

    return '';
}

export {
    areAllRequestsBeingSmartScanned,
    buildOptimisticAddCommentReportAction,
    buildOptimisticApprovedReportAction,
    buildOptimisticUnapprovedReportAction,
    buildOptimisticCancelPaymentReportAction,
    buildOptimisticChangedTaskAssigneeReportAction,
    buildOptimisticChatReport,
    buildOptimisticClosedReportAction,
    buildOptimisticCreatedReportAction,
    buildOptimisticDismissedViolationReportAction,
    buildOptimisticEditedTaskFieldReportAction,
    buildOptimisticExpenseReport,
    buildOptimisticEmptyReport,
    buildOptimisticGroupChatReport,
    buildOptimisticHoldReportAction,
    buildOptimisticHoldReportActionComment,
    buildOptimisticRetractedReportAction,
    buildOptimisticReopenedReportAction,
    buildOptimisticIOUReport,
    buildOptimisticIOUReportAction,
    buildOptimisticModifiedExpenseReportAction,
    buildOptimisticMoneyRequestEntities,
    buildOptimisticMovedReportAction,
    buildOptimisticChangePolicyReportAction,
    buildOptimisticRenamedRoomReportAction,
    buildOptimisticRoomDescriptionUpdatedReportAction,
    buildOptimisticReportPreview,
    buildOptimisticActionableTrackExpenseWhisper,
    buildOptimisticSubmittedReportAction,
    buildOptimisticTaskCommentReportAction,
    buildOptimisticTaskReport,
    buildOptimisticTaskReportAction,
    buildOptimisticUnHoldReportAction,
    buildOptimisticAnnounceChat,
    buildOptimisticWorkspaceChats,
    buildOptimisticCardAssignedReportAction,
    buildOptimisticDetachReceipt,
    buildParticipantsFromAccountIDs,
    buildReportNameFromParticipantNames,
    buildTransactionThread,
    canAccessReport,
    isReportNotFound,
    canAddTransaction,
    canDeleteTransaction,
    canBeAutoReimbursed,
    canCreateRequest,
    canCreateTaskInReport,
    canCurrentUserOpenReport,
    canDeleteReportAction,
    canHoldUnholdReportAction,
    canEditReportPolicy,
    canEditFieldOfMoneyRequest,
    canEditMoneyRequest,
    canEditPolicyDescription,
    canEditReportAction,
    canEditReportDescription,
    canEditRoomVisibility,
    canEditWriteCapability,
    canFlagReportAction,
    isNonAdminOrOwnerOfPolicyExpenseChat,
    canJoinChat,
    canLeaveChat,
    canReportBeMentionedWithinPolicy,
    canRequestMoney,
    canSeeDefaultRoom,
    canShowReportRecipientLocalTime,
    canUserPerformWriteAction,
    chatIncludesChronos,
    chatIncludesChronosWithID,
    chatIncludesConcierge,
    createDraftTransactionAndNavigateToParticipantSelector,
    doesReportBelongToWorkspace,
    findLastAccessedReport,
    findSelfDMReportID,
    formatReportLastMessageText,
    generateReportID,
    getCreationReportErrors,
    getAllAncestorReportActionIDs,
    getAllAncestorReportActions,
    getAllHeldTransactions,
    getAllPolicyReports,
    getAllWorkspaceReports,
    getAvailableReportFields,
    getBankAccountRoute,
    getChatByParticipants,
    getChatRoomSubtitle,
    getChildReportNotificationPreference,
    getCommentLength,
    getDefaultGroupAvatar,
    getDefaultWorkspaceAvatar,
    getDefaultWorkspaceAvatarTestID,
    getDeletedParentActionMessageForChatReport,
    getDisplayNameForParticipant,
    getDisplayNamesWithTooltips,
    getGroupChatName,
    prepareOnboardingOnyxData,
    getIOUReportActionDisplayMessage,
    getIOUReportActionMessage,
    getRejectedReportMessage,
    getWorkspaceNameUpdatedMessage,
    getDeletedTransactionMessage,
    getUpgradeWorkspaceMessage,
    getDowngradeWorkspaceMessage,
    getIcons,
    getIconsForParticipants,
    getIndicatedMissingPaymentMethod,
    getLastVisibleMessage,
    getMoneyRequestOptions,
    getMoneyRequestSpendBreakdown,
    getNonHeldAndFullAmount,
    getOptimisticDataForParentReportAction,
    getOriginalReportID,
    getOutstandingChildRequest,
    getParentNavigationSubtitle,
    getParsedComment,
    getParticipantsAccountIDsForDisplay,
    getParticipantsList,
    getParticipants,
    getPendingChatMembers,
    getPersonalDetailsForAccountID,
    getPolicyDescriptionText,
    getPolicyExpenseChat,
    getPolicyExpenseChatName,
    getPolicyName,
    getPolicyType,
    getReimbursementDeQueuedOrCanceledActionMessage,
    getReimbursementQueuedActionMessage,
    getReportActionActorAccountID,
    getReportDescription,
    getReportFieldKey,
    getReportIDFromLink,
    getReportName,
    getSearchReportName,
    getReportTransactions,
    reportTransactionsSelector,
    getReportNotificationPreference,
    getReportOfflinePendingActionAndErrors,
    getReportParticipantsTitle,
    getReportPreviewMessage,
    getReportRecipientAccountIDs,
    getParentReport,
    getReportOrDraftReport,
    getRoom,
    getRootParentReport,
    getRouteFromLink,
    canDeleteCardTransactionByLiabilityType,
    getTaskAssigneeChatOnyxData,
    getTransactionDetails,
    getTransactionReportName,
    getDisplayedReportID,
    getTransactionsWithReceipts,
    getUserDetailTooltipText,
    getWhisperDisplayNames,
    getWorkspaceChats,
    getWorkspaceIcon,
    goBackToDetailsPage,
    goBackFromPrivateNotes,
    getInvoicePayerName,
    getInvoicesChatName,
    getPayeeName,
    getQuickActionDetails,
    hasActionWithErrorsForTransaction,
    hasAutomatedExpensifyAccountIDs,
    hasExpensifyGuidesEmails,
    hasHeldExpenses,
    hasIOUWaitingOnCurrentUserBankAccount,
    hasMissingPaymentMethod,
    hasMissingSmartscanFields,
    hasNonReimbursableTransactions,
    hasOnlyHeldExpenses,
    hasOnlyTransactionsWithPendingRoutes,
    hasReceiptError,
    hasReceiptErrors,
    hasReportNameError,
    getReportActionWithSmartscanError,
    hasSmartscanError,
    hasUpdatedTotal,
    hasViolations,
    hasWarningTypeViolations,
    hasNoticeTypeViolations,
    hasAnyViolations,
    isActionCreator,
    isAdminRoom,
    isAdminsOnlyPostingRoom,
    isAllowedToApproveExpenseReport,
    isAllowedToComment,
    isAnnounceRoom,
    isArchivedNonExpenseReport,
    isArchivedReport,
    isArchivedNonExpenseReportWithID,
    isClosedReport,
    isCanceledTaskReport,
    isChatReport,
    isChatRoom,
    isTripRoom,
    isChatThread,
    isChildReport,
    isClosedExpenseReportWithNoExpenses,
    isCompletedTaskReport,
    isConciergeChatReport,
    isControlPolicyExpenseChat,
    isControlPolicyExpenseReport,
    isCurrentUserSubmitter,
    isCurrentUserTheOnlyParticipant,
    isDM,
    isDefaultRoom,
    isDeprecatedGroupDM,
    isEmptyReport,
    generateIsEmptyReport,
    isRootGroupChat,
    isExpenseReport,
    isExpenseRequest,
    isFinancialReportsForBusinesses,
    isExpensifyOnlyParticipantInReport,
    isGroupChat,
    isGroupChatAdmin,
    isGroupPolicy,
    isReportInGroupPolicy,
    isHoldCreator,
    isIOUOwnedByCurrentUser,
    isIOUReport,
    isIOUReportUsingReport,
    isJoinRequestInAdminRoom,
    isDomainRoom,
    isMoneyRequest,
    isMoneyRequestReport,
    isMoneyRequestReportPendingDeletion,
    isOneOnOneChat,
    isOneTransactionThread,
    isOpenExpenseReport,
    isOpenTaskReport,
    isOptimisticPersonalDetail,
    isPaidGroupPolicy,
    isPaidGroupPolicyExpenseChat,
    isPaidGroupPolicyExpenseReport,
    isPayer,
    isPolicyAdmin,
    isPolicyExpenseChat,
    isPolicyExpenseChatAdmin,
    isProcessingReport,
    isOpenReport,
    isReportIDApproved,
    isAwaitingFirstLevelApproval,
    isPublicAnnounceRoom,
    isPublicRoom,
    isReportApproved,
    isReportManuallyReimbursed,
    isReportDataReady,
    isReportFieldDisabled,
    isReportFieldOfTypeTitle,
    isReportManager,
    isReportOwner,
    isReportParticipant,
    isSelfDM,
    isSettled,
    isSystemChat,
    isTaskReport,
    isThread,
    isTrackExpenseReport,
    isUnread,
    isUnreadWithMention,
    isUserCreatedPolicyRoom,
    isValidReport,
    isValidReportIDFromPath,
    isWaitingForAssigneeToCompleteAction,
    isWaitingForSubmissionFromCurrentUser,
    isInvoiceRoom,
    isInvoiceRoomWithID,
    isInvoiceReport,
    isNewDotInvoice,
    isOpenInvoiceReport,
    isReportTransactionThread,
    getDefaultNotificationPreferenceForReport,
    canWriteInReport,
    navigateToDetailsPage,
    navigateToPrivateNotes,
    navigateBackOnDeleteTransaction,
    parseReportRouteParams,
    parseReportActionHtmlToText,
    requiresAttentionFromCurrentUser,
    shouldAutoFocusOnKeyPress,
    shouldCreateNewMoneyRequestReport,
    shouldDisableDetailPage,
    shouldDisableRename,
    shouldDisableThread,
    shouldDisplayThreadReplies,
    shouldDisplayViolationsRBRInLHN,
    shouldReportBeInOptionList,
    shouldReportShowSubscript,
    shouldShowFlagComment,
    sortOutstandingReportsBySelected,
    getReportActionWithMissingSmartscanFields,
    shouldShowRBRForMissingSmartscanFields,
    shouldUseFullTitleToDisplay,
    updateOptimisticParentReportAction,
    updateReportPreview,
    temporary_getMoneyRequestOptions,
    getTripIDFromTransactionParentReportID,
    buildOptimisticInvoiceReport,
    getInvoiceChatByParticipants,
    isCurrentUserInvoiceReceiver,
    isDraftReport,
    changeMoneyRequestHoldStatus,
    isAdminOwnerApproverOrReportOwner,
    createDraftWorkspaceAndNavigateToConfirmationScreen,
    isChatUsedForOnboarding,
    buildOptimisticExportIntegrationAction,
    getChatUsedForOnboarding,
    getFieldViolationTranslation,
    getFieldViolation,
    getReportViolations,
    findPolicyExpenseChatByPolicyID,
    getIntegrationIcon,
    getIntegrationExportIcon,
    canBeExported,
    isExported,
    hasExportError,
    getHelpPaneReportType,
    hasOnlyNonReimbursableTransactions,
    getReportLastMessage,
    getReportLastVisibleActionCreated,
    getMostRecentlyVisitedReport,
    getSourceIDFromReportAction,
    getIntegrationNameFromExportMessage,

    // This will get removed as part of https://github.com/Expensify/App/issues/59961
    // eslint-disable-next-line deprecation/deprecation
    getReportNameValuePairs,
    hasReportViolations,
    isPayAtEndExpenseReport,
    getArchiveReason,
    getApprovalChain,
    isIndividualInvoiceRoom,
    isAuditor,
    hasMissingInvoiceBankAccount,
    reasonForReportToBeInOptionList,
    getReasonAndReportActionThatRequiresAttention,
    buildOptimisticChangeFieldAction,
    isPolicyRelatedReport,
    hasReportErrorsOtherThanFailedReceipt,
    getAllReportErrors,
    getAllReportActionsErrorsAndReportActionThatRequiresAttention,
    hasInvoiceReports,
    shouldUnmaskChat,
    getReportMetadata,
    buildOptimisticSelfDMReport,
    isHiddenForCurrentUser,
    isSelectedManagerMcTest,
    isTestTransactionReport,
    getReportSubtitlePrefix,
    getPolicyChangeMessage,
    getMovedTransactionMessage,
    getExpenseReportStateAndStatus,
    generateReportName,
    navigateToLinkedReportAction,
    buildOptimisticUnreportedTransactionAction,
    buildOptimisticResolvedDuplicatesReportAction,
    getTitleReportField,
    getReportFieldsByPolicyID,
    getGroupChatDraft,
    getInvoiceReportName,
    getChatListItemReportName,
    buildOptimisticMovedTransactionAction,
    populateOptimisticReportFormula,
    getOutstandingReportsForUser,
    isReportOutstanding,
    generateReportAttributes,
    getReportPersonalDetailsParticipants,
    isAllowedToSubmitDraftExpenseReport,
    findReportIDForAction,
    isWorkspaceEligibleForReportChange,
    pushTransactionViolationsOnyxData,
    navigateOnDeleteExpense,
    hasReportBeenReopened,
    getMoneyReportPreviewName,
    getNextApproverAccountID,
    isWorkspaceTaskReport,
    isWorkspaceThread,
    getReportStatusTranslation,
};

export type {
    Ancestor,
    DisplayNameWithTooltips,
    OptimisticAddCommentReportAction,
    OptimisticChatReport,
    OptimisticClosedReportAction,
    OptimisticConciergeCategoryOptionsAction,
    OptimisticCreatedReportAction,
    OptimisticExportIntegrationAction,
    OptimisticIOUReportAction,
    OptimisticTaskReportAction,
    OptionData,
    TransactionDetails,
    PartialReportAction,
    ParsingDetails,
    MissingPaymentMethod,
    OptimisticNewReport,
    SelfDMParameters,
};
