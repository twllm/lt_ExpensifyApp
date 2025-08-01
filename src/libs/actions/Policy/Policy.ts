import {PUBLIC_DOMAINS_SET, Str} from 'expensify-common';
import escapeRegExp from 'lodash/escapeRegExp';
import lodashUnion from 'lodash/union';
import type {NullishDeep, OnyxCollection, OnyxEntry, OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import type {TupleToUnion, ValueOf} from 'type-fest';
import type {ReportExportType} from '@components/ButtonWithDropdownMenu/types';
import * as API from '@libs/API';
import type {
    AddBillingCardAndRequestWorkspaceOwnerChangeParams,
    AddPaymentCardParams,
    CreateWorkspaceFromIOUPaymentParams,
    CreateWorkspaceParams,
    DeleteWorkspaceAvatarParams,
    DeleteWorkspaceParams,
    DisablePolicyBillableModeParams,
    DowngradeToTeamParams,
    EnablePolicyAutoApprovalOptionsParams,
    EnablePolicyAutoReimbursementLimitParams,
    EnablePolicyCompanyCardsParams,
    EnablePolicyConnectionsParams,
    EnablePolicyExpensifyCardsParams,
    EnablePolicyInvoicingParams,
    EnablePolicyReportFieldsParams,
    EnablePolicyTaxesParams,
    EnablePolicyWorkflowsParams,
    LeavePolicyParams,
    OpenDraftWorkspaceRequestParams,
    OpenPolicyEditCardLimitTypePageParams,
    OpenPolicyExpensifyCardsPageParams,
    OpenPolicyInitialPageParams,
    OpenPolicyMoreFeaturesPageParams,
    OpenPolicyProfilePageParams,
    OpenPolicyTaxesPageParams,
    OpenPolicyWorkflowsPageParams,
    OpenWorkspaceInvitePageParams,
    OpenWorkspaceParams,
    RequestExpensifyCardLimitIncreaseParams,
    SetNameValuePairParams,
    SetPolicyAutomaticApprovalLimitParams,
    SetPolicyAutomaticApprovalRateParams,
    SetPolicyAutoReimbursementLimitParams,
    SetPolicyBillableModeParams,
    SetPolicyDefaultReportTitleParams,
    SetPolicyPreventMemberCreatedTitleParams,
    SetPolicyPreventSelfApprovalParams,
    SetPolicyProhibitedExpensesParams,
    SetPolicyRulesEnabledParams,
    SetWorkspaceApprovalModeParams,
    SetWorkspaceAutoReportingFrequencyParams,
    SetWorkspaceAutoReportingMonthlyOffsetParams,
    SetWorkspacePayerParams,
    SetWorkspaceReimbursementParams,
    UpdateInvoiceCompanyNameParams,
    UpdateInvoiceCompanyWebsiteParams,
    UpdatePolicyAddressParams,
    UpdateWorkspaceAvatarParams,
    UpdateWorkspaceDescriptionParams,
    UpdateWorkspaceGeneralSettingsParams,
    UpgradeToCorporateParams,
} from '@libs/API/parameters';
import type UpdatePolicyMembersCustomFieldsParams from '@libs/API/parameters/UpdatePolicyMembersCustomFieldsParams';
import type {ApiRequestCommandParameters} from '@libs/API/types';
import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import * as CurrencyUtils from '@libs/CurrencyUtils';
import DateUtils from '@libs/DateUtils';
import * as ErrorUtils from '@libs/ErrorUtils';
import {createFile} from '@libs/fileDownload/FileUtils';
import getIsNarrowLayout from '@libs/getIsNarrowLayout';
import GoogleTagManager from '@libs/GoogleTagManager';
import {translate, translateLocal} from '@libs/Localize';
import Log from '@libs/Log';
import * as NetworkStore from '@libs/Network/NetworkStore';
import * as NumberUtils from '@libs/NumberUtils';
import * as PersonalDetailsUtils from '@libs/PersonalDetailsUtils';
import * as PhoneNumber from '@libs/PhoneNumber';
import * as PolicyUtils from '@libs/PolicyUtils';
import {goBackWhenEnableFeature, isControlPolicy, navigateToExpensifyCardPage} from '@libs/PolicyUtils';
import * as ReportUtils from '@libs/ReportUtils';
import type {PolicySelector} from '@pages/home/sidebar/FloatingActionButtonAndPopover';
import type {Feature} from '@pages/OnboardingInterestedFeatures/types';
import * as PaymentMethods from '@userActions/PaymentMethods';
import * as PersistedRequests from '@userActions/PersistedRequests';
import type {EnablePolicyFeatureCommand} from '@userActions/RequestConflictUtils';
import {buildTaskData} from '@userActions/Task';
import {getOnboardingMessages} from '@userActions/Welcome/OnboardingFlow';
import type {OnboardingCompanySize, OnboardingPurpose} from '@userActions/Welcome/OnboardingFlow';
import CONST from '@src/CONST';
import type {OnboardingAccounting} from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {
    IntroSelected,
    InvitedEmailsToAccountIDs,
    PersonalDetailsList,
    Policy,
    PolicyCategory,
    PolicyEmployee,
    ReimbursementAccount,
    Report,
    ReportAction,
    ReportActions,
    Request,
    TaxRatesWithDefault,
    Transaction,
    TransactionViolations,
} from '@src/types/onyx';
import type {Errors} from '@src/types/onyx/OnyxCommon';
import type {Attributes, CompanyAddress, CustomUnit, NetSuiteCustomList, NetSuiteCustomSegment, ProhibitedExpenses, Rate, TaxRate} from '@src/types/onyx/Policy';
import type {CustomFieldType} from '@src/types/onyx/PolicyEmployee';
import type {OnyxData} from '@src/types/onyx/Request';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import {buildOptimisticMccGroup, buildOptimisticPolicyCategories} from './Category';

type ReportCreationData = Record<
    string,
    {
        reportID: string;
        reportActionID?: string;
    }
>;

type WorkspaceMembersChats = {
    onyxSuccessData: OnyxUpdate[];
    onyxOptimisticData: OnyxUpdate[];
    onyxFailureData: OnyxUpdate[];
    reportCreationData: ReportCreationData;
};

type OptimisticCustomUnits = {
    customUnits: Record<string, CustomUnit>;
    customUnitID: string;
    customUnitRateID: string;
    outputCurrency: string;
};

type WorkspaceFromIOUCreationData = {
    policyID: string;
    workspaceChatReportID: string;
    reportPreviewReportActionID?: string;
    adminsChatReportID: string;
};

type BuildPolicyDataOptions = {
    policyOwnerEmail?: string;
    makeMeAdmin?: boolean;
    policyName?: string;
    policyID?: string;
    expenseReportId?: string;
    engagementChoice?: OnboardingPurpose;
    currency?: string;
    file?: File;
    shouldAddOnboardingTasks?: boolean;
    companySize?: OnboardingCompanySize;
    userReportedIntegration?: OnboardingAccounting;
};

const allPolicies: OnyxCollection<Policy> = {};
Onyx.connect({
    key: ONYXKEYS.COLLECTION.POLICY,
    callback: (val, key) => {
        if (!key) {
            return;
        }
        if (val === null || val === undefined) {
            // If we are deleting a policy, we have to check every report linked to that policy
            // and unset the draft indicator (pencil icon) alongside removing any draft comments. Clearing these values will keep the newly archived chats from being displayed in the LHN.
            // More info: https://github.com/Expensify/App/issues/14260
            const policyID = key.replace(ONYXKEYS.COLLECTION.POLICY, '');
            const policyReports = ReportUtils.getAllPolicyReports(policyID);
            const cleanUpMergeQueries: Record<`${typeof ONYXKEYS.COLLECTION.REPORT}${string}`, NullishDeep<Report>> = {};
            const cleanUpSetQueries: Record<`${typeof ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT}${string}` | `${typeof ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS}${string}`, null> = {};
            policyReports.forEach((policyReport) => {
                if (!policyReport) {
                    return;
                }
                const {reportID} = policyReport;
                cleanUpSetQueries[`${ONYXKEYS.COLLECTION.REPORT_DRAFT_COMMENT}${reportID}`] = null;
                cleanUpSetQueries[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS}${reportID}`] = null;
            });
            Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT, cleanUpMergeQueries);
            Onyx.multiSet(cleanUpSetQueries);
            delete allPolicies[key];
            return;
        }

        allPolicies[key] = val;
    },
});

let lastAccessedWorkspacePolicyID: OnyxEntry<string>;
Onyx.connect({
    key: ONYXKEYS.LAST_ACCESSED_WORKSPACE_POLICY_ID,
    callback: (value) => (lastAccessedWorkspacePolicyID = value),
});

let allReports: OnyxCollection<Report>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT,
    waitForCollectionCallback: true,
    callback: (value) => {
        allReports = value;
    },
});

let allReportActions: OnyxCollection<ReportActions>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_ACTIONS,
    waitForCollectionCallback: true,
    callback: (actions) => {
        allReportActions = actions;
    },
});

let sessionEmail = '';
let sessionAccountID = 0;
Onyx.connect({
    key: ONYXKEYS.SESSION,
    callback: (val) => {
        sessionEmail = val?.email ?? '';
        sessionAccountID = val?.accountID ?? CONST.DEFAULT_NUMBER_ID;
    },
});

let allPersonalDetails: OnyxEntry<PersonalDetailsList>;
Onyx.connect({
    key: ONYXKEYS.PERSONAL_DETAILS_LIST,
    callback: (val) => (allPersonalDetails = val),
});

let reimbursementAccount: OnyxEntry<ReimbursementAccount>;
Onyx.connect({
    key: ONYXKEYS.REIMBURSEMENT_ACCOUNT,
    callback: (val) => (reimbursementAccount = val),
});

let allRecentlyUsedCurrencies: string[];
Onyx.connect({
    key: ONYXKEYS.RECENTLY_USED_CURRENCIES,
    callback: (val) => (allRecentlyUsedCurrencies = val ?? []),
});

let activePolicyID: OnyxEntry<string>;
Onyx.connect({
    key: ONYXKEYS.NVP_ACTIVE_POLICY_ID,
    callback: (value) => (activePolicyID = value),
});

let allTransactionViolations: OnyxCollection<TransactionViolations> = {};
Onyx.connect({
    key: ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS,
    waitForCollectionCallback: true,
    callback: (value) => (allTransactionViolations = value),
});

let introSelected: OnyxEntry<IntroSelected>;
Onyx.connect({
    key: ONYXKEYS.NVP_INTRO_SELECTED,
    callback: (value) => (introSelected = value),
});

/**
 * Stores in Onyx the policy ID of the last workspace that was accessed by the user
 */
function updateLastAccessedWorkspace(policyID: OnyxEntry<string>) {
    Onyx.set(ONYXKEYS.LAST_ACCESSED_WORKSPACE_POLICY_ID, policyID ?? null);
}

/**
 * Checks if the currency is supported for direct reimbursement
 * USD currency is the only one supported in NewDot for now
 */
function isCurrencySupportedForDirectReimbursement(currency: string) {
    return currency === CONST.CURRENCY.USD;
}

/**
 * Checks if the currency is supported for global reimbursement
 */
function isCurrencySupportedForGlobalReimbursement(currency: TupleToUnion<typeof CONST.DIRECT_REIMBURSEMENT_CURRENCIES>, canUseGlobalReimbursementsOnND: boolean) {
    return canUseGlobalReimbursementsOnND ? CONST.DIRECT_REIMBURSEMENT_CURRENCIES.includes(currency) : currency === CONST.CURRENCY.USD;
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

/** Check if the policy has invoicing company details */
function hasInvoicingDetails(policy: OnyxEntry<Policy>): boolean {
    return !!policy?.invoice?.companyName && !!policy?.invoice?.companyWebsite;
}

/**
 * Returns a primary invoice workspace for the user
 */
function getInvoicePrimaryWorkspace(currentUserLogin: string | undefined): Policy | undefined {
    if (PolicyUtils.canSendInvoiceFromWorkspace(activePolicyID)) {
        return allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${activePolicyID}`];
    }
    const activeAdminWorkspaces = PolicyUtils.getActiveAdminWorkspaces(allPolicies, currentUserLogin);
    return activeAdminWorkspaces.find((policy) => PolicyUtils.canSendInvoiceFromWorkspace(policy.id));
}

/**
 * Check if the user has any active free policies (aka workspaces)
 */
function hasActiveChatEnabledPolicies(policies: Array<OnyxEntry<PolicySelector>> | OnyxCollection<PolicySelector>, includeOnlyAdminPolicies = false): boolean {
    const chatEnabledPolicies = Object.values(policies ?? {}).filter(
        (policy) => policy?.isPolicyExpenseChatEnabled && (!includeOnlyAdminPolicies || policy.role === CONST.POLICY.ROLE.ADMIN),
    );

    if (chatEnabledPolicies.length === 0) {
        return false;
    }

    if (chatEnabledPolicies.some((policy) => !policy?.pendingAction)) {
        return true;
    }

    if (chatEnabledPolicies.some((policy) => policy?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD)) {
        return true;
    }

    if (chatEnabledPolicies.some((policy) => policy?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE)) {
        return false;
    }

    // If there are no add or delete pending actions the only option left is an update
    // pendingAction, in which case we should return true.
    return true;
}

/**
 * Delete the workspace
 */
function deleteWorkspace(policyID: string, policyName: string) {
    if (!allPolicies) {
        return;
    }

    const filteredPolicies = Object.values(allPolicies).filter((policy): policy is Policy => policy?.id !== policyID);
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                avatarURL: '',
                pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
                errors: null,
            },
        },
        ...(!hasActiveChatEnabledPolicies(filteredPolicies, true)
            ? [
                  {
                      onyxMethod: Onyx.METHOD.MERGE,
                      key: ONYXKEYS.REIMBURSEMENT_ACCOUNT,
                      value: {
                          errors: null,
                      },
                  },
              ]
            : []),
    ];

    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    // Restore the old report stateNum and statusNum
    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.REIMBURSEMENT_ACCOUNT,
            value: {
                errors: reimbursementAccount?.errors ?? null,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                avatarURL: policy?.avatarURL,
                pendingAction: null,
            },
        },
    ];

    if (policyID === activePolicyID) {
        const personalPolicyID = PolicyUtils.getPersonalPolicy()?.id;
        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.NVP_ACTIVE_POLICY_ID,
            value: personalPolicyID,
        });

        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.NVP_ACTIVE_POLICY_ID,
            value: activePolicyID,
        });
    }

    const reportsToArchive = Object.values(allReports ?? {}).filter(
        (report) => ReportUtils.isPolicyRelatedReport(report, policyID) && (ReportUtils.isChatRoom(report) || ReportUtils.isPolicyExpenseChat(report) || ReportUtils.isTaskReport(report)),
    );
    const finallyData: OnyxUpdate[] = [];
    const currentTime = DateUtils.getDBTime();
    reportsToArchive.forEach((report) => {
        const {reportID, ownerAccountID, oldPolicyName} = report ?? {};
        const isInvoiceReceiverReport = report?.invoiceReceiver && 'policyID' in report.invoiceReceiver && report.invoiceReceiver.policyID === policyID;
        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${reportID}`,
            value: {
                ...(!isInvoiceReceiverReport && {
                    oldPolicyName: allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`]?.name,
                    policyName: '',
                }),
                isPinned: false,
            },
        });

        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${reportID}`,
            value: {
                private_isArchived: currentTime,
            },
        });

        optimisticData.push({
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS}${reportID}`,
            value: null,
        });

        // Add closed actions to all chat reports linked to this policy
        // Announce & admin chats have FAKE owners, but expense chats w/ users do have owners.
        let emailClosingReport: string = CONST.POLICY.OWNER_EMAIL_FAKE;
        if (!!ownerAccountID && ownerAccountID !== CONST.POLICY.OWNER_ACCOUNT_ID_FAKE) {
            emailClosingReport = allPersonalDetails?.[ownerAccountID]?.login ?? '';
        }
        const optimisticClosedReportAction = ReportUtils.buildOptimisticClosedReportAction(emailClosingReport, policyName, CONST.REPORT.ARCHIVE_REASON.POLICY_DELETED);
        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`,
            value: {
                [optimisticClosedReportAction.reportActionID]: optimisticClosedReportAction as ReportAction,
            },
        });

        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${reportID}`,
            value: {
                oldPolicyName,
                policyName: report?.policyName,
                isPinned: report?.isPinned,
            },
        });

        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${reportID}`,
            value: {
                private_isArchived: null,
            },
        });

        // We are temporarily adding this workaround because 'DeleteWorkspace' doesn't
        // support receiving the optimistic reportActions' ids for the moment.
        finallyData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`,
            value: {
                [optimisticClosedReportAction.reportActionID]: null,
            },
        });

        if (report?.iouReportID) {
            const reportTransactions = ReportUtils.getReportTransactions(report.iouReportID);
            for (const transaction of reportTransactions) {
                const violations = allTransactionViolations?.[`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transaction.transactionID}`];
                optimisticData.push({
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transaction.transactionID}`,
                    value: violations?.filter((violation) => violation.type !== CONST.VIOLATION_TYPES.VIOLATION),
                });
                failureData.push({
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.TRANSACTION}${transaction.transactionID}`,
                    value: violations,
                });
            }
        }
    });

    const params: DeleteWorkspaceParams = {policyID};

    API.write(WRITE_COMMANDS.DELETE_WORKSPACE, params, {optimisticData, finallyData, failureData});

    // Reset the lastAccessedWorkspacePolicyID
    if (policyID === lastAccessedWorkspacePolicyID) {
        updateLastAccessedWorkspace(undefined);
    }
}

function setWorkspaceAutoReportingFrequency(policyID: string, frequency: ValueOf<typeof CONST.POLICY.AUTO_REPORTING_FREQUENCIES>) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    const wasPolicyOnManualReporting = PolicyUtils.getCorrectedAutoReportingFrequency(policy) === CONST.POLICY.AUTO_REPORTING_FREQUENCIES.MANUAL;

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                // Recall that the "daily" and "manual" frequencies don't actually exist in Onyx or the DB (see PolicyUtils.getCorrectedAutoReportingFrequency)
                autoReportingFrequency: frequency === CONST.POLICY.AUTO_REPORTING_FREQUENCIES.MANUAL ? CONST.POLICY.AUTO_REPORTING_FREQUENCIES.IMMEDIATE : frequency,
                pendingFields: {autoReportingFrequency: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE},

                // To set the frequency to "manual", we really must set it to "immediate" with harvesting disabled
                ...(frequency === CONST.POLICY.AUTO_REPORTING_FREQUENCIES.MANUAL && {
                    harvesting: {
                        enabled: false,
                    },
                }),

                // If the policy was on manual reporting before, and now will be auto-reported,
                // then we must re-enable harvesting
                ...(wasPolicyOnManualReporting &&
                    frequency !== CONST.POLICY.AUTO_REPORTING_FREQUENCIES.MANUAL && {
                        harvesting: {
                            enabled: true,
                        },
                    }),
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoReportingFrequency: policy?.autoReportingFrequency ?? null,
                harvesting: policy?.harvesting ?? null,
                pendingFields: {autoReportingFrequency: null},
                errorFields: {autoReportingFrequency: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('workflowsDelayedSubmissionPage.autoReportingFrequencyErrorMessage')},
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingFields: {autoReportingFrequency: null},
            },
        },
    ];

    const params: SetWorkspaceAutoReportingFrequencyParams = {policyID, frequency};
    API.write(WRITE_COMMANDS.SET_WORKSPACE_AUTO_REPORTING_FREQUENCY, params, {optimisticData, failureData, successData});
}

function setWorkspaceAutoReportingMonthlyOffset(policyID: string, autoReportingOffset: number | ValueOf<typeof CONST.POLICY.AUTO_REPORTING_OFFSET>) {
    const value = JSON.stringify({autoReportingOffset});
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoReportingOffset,
                pendingFields: {autoReportingOffset: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE},
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoReportingOffset: policy?.autoReportingOffset ?? null,
                pendingFields: {autoReportingOffset: null},
                errorFields: {autoReportingOffset: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('workflowsDelayedSubmissionPage.monthlyOffsetErrorMessage')},
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingFields: {autoReportingOffset: null},
            },
        },
    ];

    const params: SetWorkspaceAutoReportingMonthlyOffsetParams = {policyID, value};
    API.write(WRITE_COMMANDS.SET_WORKSPACE_AUTO_REPORTING_MONTHLY_OFFSET, params, {optimisticData, failureData, successData});
}

function setWorkspaceApprovalMode(policyID: string, approver: string, approvalMode: ValueOf<typeof CONST.POLICY.APPROVAL_MODE>) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const updatedEmployeeList: Record<string, PolicyEmployee> = {};

    if (approvalMode === CONST.POLICY.APPROVAL_MODE.OPTIONAL) {
        Object.keys(policy?.employeeList ?? {}).forEach((employee) => {
            updatedEmployeeList[employee] = {
                ...policy?.employeeList?.[employee],
                submitsTo: approver,
                forwardsTo: '',
            };
        });
    }

    const value = {
        approver,
        approvalMode,
    };

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                ...value,
                pendingFields: {approvalMode: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE},
                employeeList: approvalMode === CONST.POLICY.APPROVAL_MODE.OPTIONAL ? updatedEmployeeList : policy?.employeeList,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                approver: policy?.approver,
                approvalMode: policy?.approvalMode,
                pendingFields: {approvalMode: null},
                errorFields: {approvalMode: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('workflowsApproverPage.genericErrorMessage')},
                employeeList: policy?.employeeList,
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingFields: {approvalMode: null},
            },
        },
    ];

    const params: SetWorkspaceApprovalModeParams = {
        policyID,
        value: JSON.stringify({
            ...value,
            // This property should now be set to false for all Collect policies
            isAutoApprovalEnabled: false,
        }),
    };
    API.write(WRITE_COMMANDS.SET_WORKSPACE_APPROVAL_MODE, params, {optimisticData, failureData, successData});
}

function setWorkspacePayer(policyID: string, reimburserEmail: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                reimburser: reimburserEmail,
                achAccount: {reimburser: reimburserEmail},
                errorFields: {reimburser: null},
                pendingFields: {reimburser: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE},
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                errorFields: {reimburser: null},
                pendingFields: {reimburser: null},
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                achAccount: {reimburser: policy?.achAccount?.reimburser ?? null},
                errorFields: {reimburser: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('workflowsPayerPage.genericErrorMessage')},
                pendingFields: {reimburser: null},
            },
        },
    ];

    const params: SetWorkspacePayerParams = {policyID, reimburserEmail};

    API.write(WRITE_COMMANDS.SET_WORKSPACE_PAYER, params, {optimisticData, failureData, successData});
}

function clearPolicyErrorField(policyID: string | undefined, fieldName: string) {
    if (!policyID) {
        return;
    }
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {errorFields: {[fieldName]: null}});
}

function clearQBOErrorField(policyID: string | undefined, fieldName: string) {
    if (!policyID) {
        return;
    }
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {connections: {quickbooksOnline: {config: {errorFields: {[fieldName]: null}}}}});
}

function clearQBDErrorField(policyID: string | undefined, fieldName: string) {
    if (!policyID) {
        return;
    }
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {connections: {quickbooksDesktop: {config: {errorFields: {[fieldName]: null}}}}});
}

function clearXeroErrorField(policyID: string | undefined, fieldName: string) {
    if (!policyID) {
        return;
    }
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {connections: {xero: {config: {errorFields: {[fieldName]: null}}}}});
}

function clearNetSuiteErrorField(policyID: string | undefined, fieldName: string) {
    if (!policyID) {
        return;
    }
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {connections: {netsuite: {options: {config: {errorFields: {[fieldName]: null}}}}}});
}

function clearNetSuitePendingField(policyID: string, fieldName: string) {
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {connections: {netsuite: {options: {config: {pendingFields: {[fieldName]: null}}}}}});
}

function removeNetSuiteCustomFieldByIndex(allRecords: NetSuiteCustomSegment[] | NetSuiteCustomList[], policyID: string, importCustomField: string, valueIndex: number) {
    // We allow multiple custom list records with the same internalID. Hence it is safe to remove by index.
    const filteredRecords = allRecords.filter((_, index) => index !== Number(valueIndex));
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {
        connections: {
            netsuite: {
                options: {
                    config: {
                        syncOptions: {
                            [importCustomField]: filteredRecords,
                        },
                    },
                },
            },
        },
    });
}

function clearSageIntacctErrorField(policyID: string | undefined, fieldName: string) {
    if (!policyID) {
        return;
    }
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {connections: {intacct: {config: {errorFields: {[fieldName]: null}}}}});
}

function clearNetSuiteAutoSyncErrorField(policyID: string | undefined) {
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {connections: {netsuite: {config: {errorFields: {autoSync: null}}}}});
}

function clearQuickbooksOnlineAutoSyncErrorField(policyID: string | undefined) {
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {connections: {quickbooksOnline: {config: {errorFields: {autoSync: null}}}}});
}

function setWorkspaceReimbursement(policyID: string, reimbursementChoice: ValueOf<typeof CONST.POLICY.REIMBURSEMENT_CHOICES>, reimburserEmail: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                reimbursementChoice,
                isLoadingWorkspaceReimbursement: true,
                reimburser: reimburserEmail,
                achAccount: {reimburser: reimburserEmail},
                errorFields: {reimbursementChoice: null},
                pendingFields: {reimbursementChoice: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE},
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                isLoadingWorkspaceReimbursement: false,
                errorFields: {reimbursementChoice: null},
                pendingFields: {reimbursementChoice: null},
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                isLoadingWorkspaceReimbursement: false,
                reimbursementChoice: policy?.reimbursementChoice ?? null,
                achAccount: {reimburser: policy?.achAccount?.reimburser ?? null},
                errorFields: {reimbursementChoice: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
                pendingFields: {reimbursementChoice: null},
            },
        },
    ];

    const params: SetWorkspaceReimbursementParams = {policyID, reimbursementChoice};

    API.write(WRITE_COMMANDS.SET_WORKSPACE_REIMBURSEMENT, params, {optimisticData, failureData, successData});
}

function leaveWorkspace(policyID?: string) {
    if (!policyID) {
        return;
    }
    const policy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`];
    const workspaceChats = ReportUtils.getAllWorkspaceReports(policyID);

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
                employeeList: {
                    [sessionEmail]: {
                        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
                    },
                },
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: null,
        },
    ];
    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingAction: policy?.pendingAction ?? null,
                employeeList: {
                    [sessionEmail]: {
                        errors: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('workspace.people.error.genericRemove'),
                    },
                },
            },
        },
    ];

    const pendingChatMembers = ReportUtils.getPendingChatMembers([sessionAccountID], [], CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE);

    workspaceChats.forEach((report) => {
        const parentReport = ReportUtils.getRootParentReport({report});
        const reportToCheckOwner = isEmptyObject(parentReport) ? report : parentReport;

        if (ReportUtils.isPolicyExpenseChat(report) && !ReportUtils.isReportOwner(reportToCheckOwner)) {
            return;
        }

        optimisticData.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${report?.reportID}`,
                value: {
                    statusNum: CONST.REPORT.STATUS_NUM.CLOSED,
                    stateNum: CONST.REPORT.STATE_NUM.APPROVED,
                    oldPolicyName: policy?.name ?? '',
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${report?.reportID}`,
                value: {
                    pendingChatMembers,
                },
            },
        );
        successData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${report?.reportID}`,
            value: {
                pendingChatMembers: null,
            },
        });
        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${report?.reportID}`,
            value: {
                pendingChatMembers: null,
            },
        });
    });

    const params: LeavePolicyParams = {
        policyID,
        email: sessionEmail,
    };
    API.write(WRITE_COMMANDS.LEAVE_POLICY, params, {optimisticData, successData, failureData});
}

function updateDefaultPolicy(newPolicyID?: string, oldPolicyID?: string) {
    if (!newPolicyID) {
        return;
    }
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.NVP_ACTIVE_POLICY_ID,
            value: newPolicyID,
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.NVP_ACTIVE_POLICY_ID,
            value: oldPolicyID,
        },
    ];

    const parameters: SetNameValuePairParams = {
        name: ONYXKEYS.NVP_ACTIVE_POLICY_ID,
        value: newPolicyID,
    };

    API.write(WRITE_COMMANDS.SET_NAME_VALUE_PAIR, parameters, {
        optimisticData,
        failureData,
    });
}

function addBillingCardAndRequestPolicyOwnerChange(
    policyID: string | undefined,
    cardData: {
        cardNumber: string;
        cardYear: string;
        cardMonth: string;
        cardCVV: string;
        addressName: string;
        addressZip: string;
        currency: string;
    },
) {
    if (!policyID) {
        return;
    }

    const {cardNumber, cardYear, cardMonth, cardCVV, addressName, addressZip, currency} = cardData;

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                errorFields: null,
                isLoading: true,
                isChangeOwnerSuccessful: false,
                isChangeOwnerFailed: false,
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                isLoading: false,
                isChangeOwnerSuccessful: true,
                isChangeOwnerFailed: false,
                owner: sessionEmail,
                ownerAccountID: sessionAccountID,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                isLoading: false,
                isChangeOwnerSuccessful: false,
                isChangeOwnerFailed: true,
            },
        },
    ];

    if (CONST.SCA_CURRENCIES.has(currency)) {
        const params: AddPaymentCardParams = {
            cardNumber,
            cardYear,
            cardMonth,
            cardCVV,
            addressName,
            addressZip,
            currency: currency as ValueOf<typeof CONST.PAYMENT_CARD_CURRENCY>,
            isP2PDebitCard: false,
        };
        PaymentMethods.addPaymentCardSCA(params);
    } else {
        const params: AddBillingCardAndRequestWorkspaceOwnerChangeParams = {
            policyID,
            cardNumber,
            cardYear,
            cardMonth,
            cardCVV,
            addressName,
            addressZip,
            currency: currency as ValueOf<typeof CONST.PAYMENT_CARD_CURRENCY>,
        };
        // eslint-disable-next-line rulesdir/no-multiple-api-calls
        API.write(WRITE_COMMANDS.ADD_BILLING_CARD_AND_REQUEST_WORKSPACE_OWNER_CHANGE, params, {optimisticData, successData, failureData});
    }
}

/**
 * Properly updates the nvp_privateStripeCustomerID onyx data for 3DS payment
 *
 */
function verifySetupIntentAndRequestPolicyOwnerChange(policyID: string) {
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                errorFields: null,
                isLoading: true,
                isChangeOwnerSuccessful: false,
                isChangeOwnerFailed: false,
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                isLoading: false,
                isChangeOwnerSuccessful: true,
                isChangeOwnerFailed: false,
                owner: sessionEmail,
                ownerAccountID: sessionAccountID,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                isLoading: false,
                isChangeOwnerSuccessful: false,
                isChangeOwnerFailed: true,
            },
        },
    ];
    API.write(WRITE_COMMANDS.VERIFY_SETUP_INTENT_AND_REQUEST_POLICY_OWNER_CHANGE, {accountID: sessionAccountID, policyID}, {optimisticData, successData, failureData});
}

/**
 * Optimistically create a chat for each member of the workspace, creates both optimistic and success data for onyx.
 *
 * @returns - object with onyxSuccessData, onyxOptimisticData, and optimisticReportIDs (map login to reportID)
 */
function createPolicyExpenseChats(policyID: string, invitedEmailsToAccountIDs: InvitedEmailsToAccountIDs, hasOutstandingChildRequest = false): WorkspaceMembersChats {
    const workspaceMembersChats: WorkspaceMembersChats = {
        onyxSuccessData: [],
        onyxOptimisticData: [],
        onyxFailureData: [],
        reportCreationData: {},
    };

    Object.keys(invitedEmailsToAccountIDs).forEach((email) => {
        const accountID = invitedEmailsToAccountIDs[email];
        const cleanAccountID = Number(accountID);
        const login = PhoneNumber.addSMSDomainIfPhoneNumber(email);

        const oldChat = ReportUtils.getPolicyExpenseChat(cleanAccountID, policyID);

        // If the chat already exists, we don't want to create a new one - just make sure it's not archived
        if (oldChat) {
            workspaceMembersChats.reportCreationData[login] = {
                reportID: oldChat.reportID,
            };
            workspaceMembersChats.onyxOptimisticData.push({
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${oldChat.reportID}`,
                value: {
                    stateNum: CONST.REPORT.STATE_NUM.OPEN,
                    statusNum: CONST.REPORT.STATUS_NUM.OPEN,
                },
            });
            workspaceMembersChats.onyxOptimisticData.push({
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${oldChat.reportID}`,
                value: {
                    private_isArchived: false,
                },
            });
            const currentTime = DateUtils.getDBTime();
            const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${oldChat.reportID}`] ?? {};
            Object.values(reportActions).forEach((action) => {
                if (action.actionName !== CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW) {
                    return;
                }
                workspaceMembersChats.onyxOptimisticData.push({
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${action.childReportID}`,
                    value: {
                        private_isArchived: null,
                    },
                });
                workspaceMembersChats.onyxFailureData.push({
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${action.childReportID}`,
                    value: {
                        private_isArchived: currentTime,
                    },
                });
            });
            return;
        }
        const optimisticReport = ReportUtils.buildOptimisticChatReport({
            participantList: [sessionAccountID, cleanAccountID],
            chatType: CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT,
            policyID,
            ownerAccountID: cleanAccountID,
            notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN,
        });

        // Set correct notification preferences: visible for the submitter, hidden for others until there's activity
        if (optimisticReport.participants) {
            optimisticReport.participants[cleanAccountID] = {
                ...optimisticReport.participants[cleanAccountID],
                notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS,
            };
        }
        const optimisticCreatedAction = ReportUtils.buildOptimisticCreatedReportAction(login);

        workspaceMembersChats.reportCreationData[login] = {
            reportID: optimisticReport.reportID,
            reportActionID: optimisticCreatedAction.reportActionID,
        };

        workspaceMembersChats.onyxOptimisticData.push(
            {
                onyxMethod: Onyx.METHOD.SET,
                key: `${ONYXKEYS.COLLECTION.REPORT}${optimisticReport.reportID}`,
                value: {
                    ...optimisticReport,
                    pendingFields: {
                        createChat: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    },
                    hasOutstandingChildRequest,
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${optimisticReport.reportID}`,
                value: {
                    isOptimisticReport: true,
                    pendingChatMembers: [
                        {
                            accountID: accountID.toString(),
                            pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                        },
                    ],
                },
            },
        );
        workspaceMembersChats.onyxOptimisticData.push({
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${optimisticReport.reportID}`,
            value: {[optimisticCreatedAction.reportActionID]: optimisticCreatedAction},
        });

        workspaceMembersChats.onyxSuccessData.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${optimisticReport.reportID}`,
                value: {
                    pendingFields: {
                        createChat: null,
                    },
                    errorFields: {
                        createChat: null,
                    },
                    participants: {
                        [accountID]: allPersonalDetails && allPersonalDetails[accountID] ? {} : null,
                    },
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${optimisticReport.reportID}`,
                value: {
                    isOptimisticReport: false,
                    pendingChatMembers: null,
                },
            },
        );
        workspaceMembersChats.onyxSuccessData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${optimisticReport.reportID}`,
            value: {[optimisticCreatedAction.reportActionID]: {pendingAction: null}},
        });

        workspaceMembersChats.onyxFailureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${optimisticReport.reportID}`,
            value: {
                isLoadingInitialReportActions: false,
            },
        });

        workspaceMembersChats.onyxFailureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${optimisticReport.reportID}`,
            value: {
                errorFields: {
                    createChat: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('report.genericCreateReportFailureMessage'),
                },
            },
        });
    });
    return workspaceMembersChats;
}

/**
 * Updates a workspace avatar image
 */
function updateWorkspaceAvatar(policyID: string, file: File) {
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                avatarURL: file.uri,
                originalFileName: file.name,
                errorFields: {
                    avatarURL: null,
                },
                pendingFields: {
                    avatarURL: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                },
            },
        },
    ];
    const finallyData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingFields: {
                    avatarURL: null,
                },
            },
        },
    ];
    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                avatarURL: allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`]?.avatarURL,
            },
        },
    ];

    const params: UpdateWorkspaceAvatarParams = {
        policyID,
        file,
    };

    API.write(WRITE_COMMANDS.UPDATE_WORKSPACE_AVATAR, params, {optimisticData, finallyData, failureData});
}

/**
 * Deletes the avatar image for the workspace
 */
function deleteWorkspaceAvatar(policyID: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingFields: {
                    avatarURL: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                },
                errorFields: {
                    avatarURL: null,
                },
                avatarURL: '',
                originalFileName: null,
            },
        },
    ];
    const finallyData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingFields: {
                    avatarURL: null,
                },
            },
        },
    ];
    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                avatarURL: policy?.avatarURL,
                originalFileName: policy?.originalFileName,
                errorFields: {
                    avatarURL: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('avatarWithImagePicker.deleteWorkspaceError'),
                },
            },
        },
    ];

    const params: DeleteWorkspaceAvatarParams = {policyID};

    API.write(WRITE_COMMANDS.DELETE_WORKSPACE_AVATAR, params, {optimisticData, finallyData, failureData});
}

/**
 * Clear error and pending fields for the workspace avatar
 */
function clearAvatarErrors(policyID: string) {
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {
        errorFields: {
            avatarURL: null,
        },
        pendingFields: {
            avatarURL: null,
        },
    });
}

/**
 * Optimistically update the general settings. Set the general settings as pending until the response succeeds.
 * If the response fails set a general error message. Clear the error message when updating.
 */
function updateGeneralSettings(policyID: string | undefined, name: string, currencyValue?: string) {
    if (!policyID) {
        return;
    }

    const policy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`];
    if (!policy) {
        return;
    }

    const distanceUnit = PolicyUtils.getDistanceRateCustomUnit(policy);
    const customUnitID = distanceUnit?.customUnitID;
    const currency = currencyValue ?? policy?.outputCurrency ?? CONST.CURRENCY.USD;

    const currencyPendingAction = currency !== policy?.outputCurrency ? CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE : undefined;
    const namePendingAction = name !== policy?.name ? CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE : undefined;

    const currentRates = distanceUnit?.rates ?? {};
    const optimisticRates: Record<string, Rate> = {};
    const finallyRates: Record<string, Rate> = {};
    const failureRates: Record<string, Rate> = {};

    if (customUnitID) {
        for (const rateID of Object.keys(currentRates)) {
            optimisticRates[rateID] = {
                ...currentRates[rateID],
                pendingFields: {currency: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE},
                currency,
            };
            finallyRates[rateID] = {
                ...currentRates[rateID],
                pendingFields: {currency: null},
                currency,
            };
            failureRates[rateID] = {
                ...currentRates[rateID],
                pendingFields: {currency: null},
                errorFields: {currency: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
            };
        }
    }

    const optimisticData: OnyxUpdate[] = [
        {
            // We use SET because it's faster than merge and avoids a race condition when setting the currency and navigating the user to the Bank account page in confirmCurrencyChangeAndHideModal
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                ...policy,

                pendingFields: {
                    ...policy.pendingFields,
                    ...(namePendingAction !== undefined && {name: namePendingAction}),
                    ...(currencyPendingAction !== undefined && {outputCurrency: currencyPendingAction}),
                },

                // Clear errorFields in case the user didn't dismiss the general settings error
                errorFields: {
                    name: null,
                    outputCurrency: null,
                },
                name,
                outputCurrency: currency,
                ...(customUnitID && {
                    customUnits: {
                        ...policy.customUnits,
                        [customUnitID]: {
                            ...distanceUnit,
                            rates: optimisticRates,
                        },
                    },
                }),
            },
        },
    ];
    const finallyData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingFields: {
                    name: null,
                    outputCurrency: null,
                },
                ...(customUnitID && {
                    customUnits: {
                        [customUnitID]: {
                            ...distanceUnit,
                            rates: finallyRates,
                        },
                    },
                }),
            },
        },
    ];

    const errorFields: Policy['errorFields'] = {
        name: namePendingAction && ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('workspace.editor.genericFailureMessage'),
    };

    if (!errorFields.name && currencyPendingAction) {
        errorFields.outputCurrency = ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('workspace.editor.genericFailureMessage');
    }

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                errorFields,
                ...(customUnitID && {
                    customUnits: {
                        [customUnitID]: {
                            ...distanceUnit,
                            rates: failureRates,
                        },
                    },
                }),
            },
        },
    ];

    const params: UpdateWorkspaceGeneralSettingsParams = {
        policyID,
        workspaceName: name,
        currency,
    };

    const persistedRequests = PersistedRequests.getAll();
    const createWorkspaceRequestChangedIndex = persistedRequests.findIndex(
        (request) => request.data?.policyID === policyID && request.command === WRITE_COMMANDS.CREATE_WORKSPACE && request.data?.policyName !== name,
    );

    const createWorkspaceRequest = persistedRequests.at(createWorkspaceRequestChangedIndex);
    if (createWorkspaceRequest && createWorkspaceRequestChangedIndex !== -1) {
        const workspaceRequest: Request = {
            ...createWorkspaceRequest,
            data: {
                ...createWorkspaceRequest.data,
                policyName: name,
            },
        };
        Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {
            name,
        });

        PersistedRequests.update(createWorkspaceRequestChangedIndex, workspaceRequest);
        return;
    }

    API.write(WRITE_COMMANDS.UPDATE_WORKSPACE_GENERAL_SETTINGS, params, {
        optimisticData,
        finallyData,
        failureData,
    });
}

function updateWorkspaceDescription(policyID: string, description: string, currentDescription: string | undefined) {
    if (description === currentDescription) {
        return;
    }
    const parsedDescription = ReportUtils.getParsedComment(description);

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                description: parsedDescription,
                pendingFields: {
                    description: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                },
                errorFields: {
                    description: null,
                },
            },
        },
    ];
    const finallyData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingFields: {
                    description: null,
                },
            },
        },
    ];
    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                errorFields: {
                    description: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('workspace.editor.genericFailureMessage'),
                },
            },
        },
    ];

    const params: UpdateWorkspaceDescriptionParams = {
        policyID,
        description: parsedDescription,
    };

    API.write(WRITE_COMMANDS.UPDATE_WORKSPACE_DESCRIPTION, params, {
        optimisticData,
        finallyData,
        failureData,
    });
}

function setWorkspaceErrors(policyID: string, errors: Errors) {
    if (!allPolicies?.[policyID]) {
        return;
    }

    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {errors: null});
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {errors});
}

function hideWorkspaceAlertMessage(policyID: string) {
    if (!allPolicies?.[policyID]) {
        return;
    }

    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {alertMessage: ''});
}

function updateAddress(policyID: string, newAddress: CompanyAddress) {
    // TODO: Change API endpoint parameters format to make it possible to follow naming-convention
    const parameters: UpdatePolicyAddressParams = {
        policyID,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'data[addressStreet]': newAddress.addressStreet,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'data[city]': newAddress.city,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'data[country]': newAddress.country,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'data[state]': newAddress.state,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'data[zipCode]': newAddress.zipCode,
    };

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                address: newAddress,
                pendingFields: {
                    address: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                },
            },
        },
    ];

    const finallyData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                address: newAddress,
                pendingFields: {
                    address: null,
                },
            },
        },
    ];

    API.write(WRITE_COMMANDS.UPDATE_POLICY_ADDRESS, parameters, {
        optimisticData,
        finallyData,
    });
}

/**
 * Removes an error after trying to delete a workspace
 */
function clearDeleteWorkspaceError(policyID: string) {
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {
        pendingAction: null,
        errors: null,
    });
}

/**
 * Removes the workspace after failure to create.
 */
function removeWorkspace(policyID: string) {
    Onyx.set(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, null);
}

/**
 * Generate a policy name based on an email and policy list.
 * @param [email] the email to base the workspace name on. If not passed, will use the logged-in user's email instead
 */
function generateDefaultWorkspaceName(email = ''): string {
    const emailParts = email ? email.split('@') : sessionEmail.split('@');
    if (!emailParts || emailParts.length !== 2) {
        return '';
    }
    const username = emailParts.at(0) ?? '';
    const domain = emailParts.at(1) ?? '';
    const userDetails = PersonalDetailsUtils.getPersonalDetailByEmail(email || sessionEmail);
    const displayName = userDetails?.displayName?.trim();
    let displayNameForWorkspace = '';

    if (!PUBLIC_DOMAINS_SET.has(domain.toLowerCase())) {
        displayNameForWorkspace = Str.UCFirst(domain.split('.').at(0) ?? '');
    } else if (displayName) {
        displayNameForWorkspace = Str.UCFirst(displayName);
    } else if (PUBLIC_DOMAINS_SET.has(domain.toLowerCase())) {
        displayNameForWorkspace = Str.UCFirst(username);
    } else {
        displayNameForWorkspace = userDetails?.phoneNumber ?? '';
    }

    const isSMSDomain = `@${domain}` === CONST.SMS.DOMAIN;
    if (isSMSDomain) {
        displayNameForWorkspace = translateLocal('workspace.new.myGroupWorkspace', {});
    }

    if (isEmptyObject(allPolicies)) {
        return isSMSDomain ? translateLocal('workspace.new.myGroupWorkspace', {}) : translateLocal('workspace.new.workspaceName', {userName: displayNameForWorkspace});
    }

    // find default named workspaces and increment the last number
    const escapedName = escapeRegExp(displayNameForWorkspace);
    const workspaceTranslations = Object.values(CONST.LOCALES)
        .map((lang) => translate(lang, 'workspace.common.workspace'))
        .join('|');

    const workspaceRegex = isSMSDomain ? new RegExp(`^${escapedName}\\s*(\\d+)?$`, 'i') : new RegExp(`^(?=.*${escapedName})(?:.*(?:${workspaceTranslations})\\s*(\\d+)?)`, 'i');

    const workspaceNumbers = Object.values(allPolicies)
        .map((policy) => workspaceRegex.exec(policy?.name ?? ''))
        .filter(Boolean) // Remove null matches
        .map((match) => Number(match?.[1] ?? '0'));
    const lastWorkspaceNumber = workspaceNumbers.length > 0 ? Math.max(...workspaceNumbers) : undefined;

    if (isSMSDomain) {
        return translateLocal('workspace.new.myGroupWorkspace', {workspaceNumber: lastWorkspaceNumber !== undefined ? lastWorkspaceNumber + 1 : undefined});
    }
    return translateLocal('workspace.new.workspaceName', {userName: displayNameForWorkspace, workspaceNumber: lastWorkspaceNumber !== undefined ? lastWorkspaceNumber + 1 : undefined});
}

/**
 * Returns a client generated 16 character hexadecimal value for the policyID
 */
function generatePolicyID(): string {
    return NumberUtils.generateHexadecimalValue(16);
}

/**
 * Returns a client generated 13 character hexadecimal value for a custom unit ID
 */
function generateCustomUnitID(): string {
    return NumberUtils.generateHexadecimalValue(13);
}

function buildOptimisticDistanceRateCustomUnits(reportCurrency?: string): OptimisticCustomUnits {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Disabling this line for safeness as nullish coalescing works only if the value is undefined or null
    const currency = reportCurrency || (allPersonalDetails?.[sessionAccountID]?.localCurrencyCode ?? CONST.CURRENCY.USD);
    const customUnitID = generateCustomUnitID();
    const customUnitRateID = generateCustomUnitID();

    const customUnits: Record<string, CustomUnit> = {
        [customUnitID]: {
            customUnitID,
            name: CONST.CUSTOM_UNITS.NAME_DISTANCE,
            attributes: {
                unit: CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES,
            },
            rates: {
                [customUnitRateID]: {
                    customUnitRateID,
                    name: CONST.CUSTOM_UNITS.DEFAULT_RATE,
                    rate: CONST.CUSTOM_UNITS.MILEAGE_IRS_RATE * CONST.POLICY.CUSTOM_UNIT_RATE_BASE_OFFSET,
                    enabled: true,
                    currency,
                },
            },
        },
    };

    return {
        customUnits,
        customUnitID,
        customUnitRateID,
        outputCurrency: currency,
    };
}

/**
 * Optimistically creates a Policy Draft for a new workspace
 *
 * @param [policyOwnerEmail] the email of the account to make the owner of the policy
 * @param [policyName] custom policy name we will use for created workspace
 * @param [policyID] custom policy id we will use for created workspace
 * @param [makeMeAdmin] leave the calling account as an admin on the policy
 * @param [currency] Optional, selected currency for the workspace
 * @param [file], avatar file for workspace
 */
function createDraftInitialWorkspace(policyOwnerEmail = '', policyName = '', policyID = generatePolicyID(), makeMeAdmin = false, currency = '', file?: File) {
    const workspaceName = policyName || generateDefaultWorkspaceName(policyOwnerEmail);
    const {customUnits, outputCurrency} = buildOptimisticDistanceRateCustomUnits(currency);
    const shouldEnableWorkflowsByDefault =
        !introSelected?.choice || introSelected.choice === CONST.ONBOARDING_CHOICES.MANAGE_TEAM || introSelected.choice === CONST.ONBOARDING_CHOICES.LOOKING_AROUND;

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.POLICY_DRAFTS}${policyID}`,
            value: {
                id: policyID,
                type: CONST.POLICY.TYPE.TEAM,
                name: workspaceName,
                role: CONST.POLICY.ROLE.ADMIN,
                owner: sessionEmail,
                ownerAccountID: sessionAccountID,
                isPolicyExpenseChatEnabled: true,
                areCategoriesEnabled: true,
                approver: sessionEmail,
                areCompanyCardsEnabled: true,
                areExpensifyCardsEnabled: false,
                outputCurrency,
                pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                customUnits,
                makeMeAdmin,
                autoReporting: true,
                autoReportingFrequency: shouldEnableWorkflowsByDefault ? CONST.POLICY.AUTO_REPORTING_FREQUENCIES.IMMEDIATE : CONST.POLICY.AUTO_REPORTING_FREQUENCIES.INSTANT,
                avatarURL: file?.uri ?? null,
                harvesting: {
                    enabled: !shouldEnableWorkflowsByDefault,
                },
                originalFileName: file?.name,
                employeeList: {
                    [sessionEmail]: {
                        submitsTo: sessionEmail,
                        email: sessionEmail,
                        role: CONST.POLICY.ROLE.ADMIN,
                        errors: {},
                    },
                },
                approvalMode: CONST.POLICY.APPROVAL_MODE.OPTIONAL,
                pendingFields: {
                    autoReporting: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    approvalMode: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    reimbursementChoice: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                },
                areWorkflowsEnabled: shouldEnableWorkflowsByDefault,
                defaultBillable: false,
                disabledFields: {defaultBillable: true},
                requiresCategory: true,
            },
        },
    ];

    Onyx.update(optimisticData);
}

/**
 * Generates onyx data for creating a new workspace
 *
 * @param [policyOwnerEmail] the email of the account to make the owner of the policy
 * @param [makeMeAdmin] leave the calling account as an admin on the policy
 * @param [policyName] custom policy name we will use for created workspace
 * @param [policyID] custom policy id we will use for created workspace
 * @param [expenseReportId] Optional, Purpose of using application selected by user in guided setup flow
 * @param [engagementChoice] Purpose of using application selected by user in guided setup flow
 * @param [currency] Optional, selected currency for the workspace
 * @param [file] Optional, avatar file for workspace
 * @param [shouldAddOnboardingTasks] whether to add onboarding tasks to the workspace
 */
function buildPolicyData(options: BuildPolicyDataOptions = {}) {
    const {
        policyOwnerEmail = '',
        makeMeAdmin = false,
        policyName = '',
        policyID = generatePolicyID(),
        expenseReportId,
        engagementChoice,
        currency = '',
        file,
        shouldAddOnboardingTasks = true,
        companySize,
        userReportedIntegration,
    } = options;
    const workspaceName = policyName || generateDefaultWorkspaceName(policyOwnerEmail);

    const {customUnits, customUnitID, customUnitRateID, outputCurrency} = buildOptimisticDistanceRateCustomUnits(currency);

    const {
        adminsChatReportID,
        adminsChatData,
        adminsReportActionData,
        adminsCreatedReportActionID,
        expenseChatReportID,
        expenseChatData,
        expenseReportActionData,
        expenseCreatedReportActionID,
        pendingChatMembers,
    } = ReportUtils.buildOptimisticWorkspaceChats(policyID, workspaceName, expenseReportId);

    const optimisticCategoriesData = buildOptimisticPolicyCategories(policyID, Object.values(CONST.POLICY.DEFAULT_CATEGORIES));
    const optimisticMccGroupData = buildOptimisticMccGroup();

    const shouldEnableWorkflowsByDefault =
        !engagementChoice ||
        engagementChoice === CONST.ONBOARDING_CHOICES.MANAGE_TEAM ||
        engagementChoice === CONST.ONBOARDING_CHOICES.LOOKING_AROUND ||
        engagementChoice === CONST.ONBOARDING_CHOICES.PERSONAL_SPEND ||
        engagementChoice === CONST.ONBOARDING_CHOICES.TRACK_WORKSPACE;
    const shouldSetCreatedWorkspaceAsActivePolicy = !!activePolicyID && allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${activePolicyID}`]?.type === CONST.POLICY.TYPE.PERSONAL;

    // Determine workspace type based on user reported integration
    const workspaceType =
        userReportedIntegration && (CONST.POLICY.CONNECTIONS.CORPORATE as readonly string[]).includes(userReportedIntegration) ? CONST.POLICY.TYPE.CORPORATE : CONST.POLICY.TYPE.TEAM;

    // WARNING: The data below should be kept in sync with the API so we create the policy with the correct configuration.
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                id: policyID,
                type: workspaceType,
                name: workspaceName,
                role: CONST.POLICY.ROLE.ADMIN,
                owner: sessionEmail,
                ownerAccountID: sessionAccountID,
                isPolicyExpenseChatEnabled: true,
                outputCurrency,
                pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                autoReporting: true,
                approver: sessionEmail,
                autoReportingFrequency: shouldEnableWorkflowsByDefault ? CONST.POLICY.AUTO_REPORTING_FREQUENCIES.IMMEDIATE : CONST.POLICY.AUTO_REPORTING_FREQUENCIES.INSTANT,
                approvalMode:
                    shouldEnableWorkflowsByDefault && engagementChoice !== CONST.ONBOARDING_CHOICES.TRACK_WORKSPACE ? CONST.POLICY.APPROVAL_MODE.BASIC : CONST.POLICY.APPROVAL_MODE.OPTIONAL,
                harvesting: {
                    enabled: !shouldEnableWorkflowsByDefault,
                },
                customUnits,
                areCategoriesEnabled: true,
                areCompanyCardsEnabled: true,
                areTagsEnabled: false,
                areDistanceRatesEnabled: false,
                areWorkflowsEnabled: shouldEnableWorkflowsByDefault,
                areReportFieldsEnabled: false,
                areConnectionsEnabled: false,
                areExpensifyCardsEnabled: false,
                employeeList: {
                    [sessionEmail]: {
                        submitsTo: sessionEmail,
                        email: sessionEmail,
                        role: CONST.POLICY.ROLE.ADMIN,
                        errors: {},
                    },
                },
                chatReportIDAdmins: makeMeAdmin ? Number(adminsChatReportID) : undefined,
                pendingFields: {
                    autoReporting: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    approvalMode: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    reimbursementChoice: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    name: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    outputCurrency: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    address: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    description: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    type: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    areReportFieldsEnabled: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                },
                defaultBillable: false,
                disabledFields: {defaultBillable: true},
                avatarURL: file?.uri,
                originalFileName: file?.name,
                ...optimisticMccGroupData.optimisticData,
                requiresCategory: true,
                fieldList: {
                    [CONST.POLICY.FIELDS.FIELD_LIST_TITLE]: {
                        defaultValue: CONST.POLICY.DEFAULT_REPORT_NAME_PATTERN,
                        pendingFields: {defaultValue: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD, deletable: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD},
                        type: CONST.POLICY.DEFAULT_FIELD_LIST_TYPE,
                        target: CONST.POLICY.DEFAULT_FIELD_LIST_TARGET,
                        name: CONST.POLICY.DEFAULT_FIELD_LIST_NAME,
                        fieldID: CONST.POLICY.FIELDS.FIELD_LIST_TITLE,
                        deletable: true,
                    },
                },
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${expenseChatReportID}`,
            value: {
                isOptimisticReport: true,
            },
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT}${adminsChatReportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                },
                ...adminsChatData,
            },
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${adminsChatReportID}`,
            value: {
                pendingChatMembers,
            },
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${adminsChatReportID}`,
            value: adminsReportActionData,
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT}${expenseChatReportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                },
                ...expenseChatData,
            },
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${expenseChatReportID}`,
            value: expenseReportActionData,
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.POLICY_DRAFTS}${policyID}`,
            value: null,
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_DRAFT}${expenseChatReportID}`,
            value: null,
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_DRAFT}${adminsChatReportID}`,
            value: null,
        },
    ];

    if (shouldSetCreatedWorkspaceAsActivePolicy) {
        optimisticData.push({
            onyxMethod: Onyx.METHOD.SET,
            key: ONYXKEYS.NVP_ACTIVE_POLICY_ID,
            value: policyID,
        });
    }

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingAction: null,
                pendingFields: {
                    autoReporting: null,
                    approvalMode: null,
                    reimbursementChoice: null,
                    name: null,
                    outputCurrency: null,
                    address: null,
                    description: null,
                    type: null,
                    areReportFieldsEnabled: null,
                },
                ...optimisticMccGroupData.successData,
                fieldList: {
                    [CONST.POLICY.FIELDS.FIELD_LIST_TITLE]: {
                        pendingFields: {
                            defaultValue: null,
                            deletable: null,
                        },
                    },
                },
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${adminsChatReportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: null,
                },
                pendingAction: null,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${adminsChatReportID}`,
            value: {
                isOptimisticReport: false,
                pendingChatMembers: [],
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${adminsChatReportID}`,
            value: {
                [adminsCreatedReportActionID]: {
                    pendingAction: null,
                },
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${expenseChatReportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: null,
                },
                pendingAction: null,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${expenseChatReportID}`,
            value: {
                isOptimisticReport: false,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${expenseChatReportID}`,
            value: {
                [expenseCreatedReportActionID]: {
                    pendingAction: null,
                },
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {employeeList: null, ...optimisticMccGroupData.failureData},
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT}${adminsChatReportID}`,
            value: null,
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${adminsChatReportID}`,
            value: null,
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT}${expenseChatReportID}`,
            value: null,
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${expenseChatReportID}`,
            value: null,
        },
    ];

    if (shouldSetCreatedWorkspaceAsActivePolicy) {
        failureData.push({
            onyxMethod: Onyx.METHOD.SET,
            key: ONYXKEYS.NVP_ACTIVE_POLICY_ID,
            value: activePolicyID,
        });
    }

    if (optimisticCategoriesData.optimisticData) {
        optimisticData.push(...optimisticCategoriesData.optimisticData);
    }

    if (optimisticCategoriesData.failureData) {
        failureData.push(...optimisticCategoriesData.failureData);
    }

    if (optimisticCategoriesData.successData) {
        successData.push(...optimisticCategoriesData.successData);
    }

    // We need to clone the file to prevent non-indexable errors.
    const clonedFile = file ? (createFile(file) as File) : undefined;

    const params: CreateWorkspaceParams = {
        policyID,
        adminsChatReportID,
        expenseChatReportID,
        ownerEmail: policyOwnerEmail,
        makeMeAdmin,
        policyName: workspaceName,
        type: workspaceType,
        adminsCreatedReportActionID,
        expenseCreatedReportActionID,
        customUnitID,
        customUnitRateID,
        engagementChoice,
        currency: outputCurrency,
        file: clonedFile,
        companySize,
        userReportedIntegration: userReportedIntegration ?? undefined,
    };

    if (
        introSelected !== undefined &&
        (introSelected.choice === CONST.ONBOARDING_CHOICES.TEST_DRIVE_RECEIVER || !introSelected?.createWorkspace) &&
        engagementChoice &&
        shouldAddOnboardingTasks
    ) {
        const {onboardingMessages} = getOnboardingMessages();
        const onboardingData = ReportUtils.prepareOnboardingOnyxData(introSelected, engagementChoice, onboardingMessages[engagementChoice], adminsChatReportID, policyID);
        if (!onboardingData) {
            return {successData, optimisticData, failureData, params};
        }
        const {guidedSetupData, optimisticData: taskOptimisticData, successData: taskSuccessData, failureData: taskFailureData} = onboardingData;

        params.guidedSetupData = JSON.stringify(guidedSetupData);
        params.engagementChoice = engagementChoice;

        optimisticData.push(...taskOptimisticData);
        successData.push(...taskSuccessData);
        failureData.push(...taskFailureData);
    }

    // For test drive receivers, we want to complete the createWorkspace task in concierge, instead of #admin room
    if (introSelected?.choice === CONST.ONBOARDING_CHOICES.TEST_DRIVE_RECEIVER && introSelected.createWorkspace) {
        const createWorkspaceTaskReport = {reportID: introSelected.createWorkspace};
        const {
            optimisticData: optimisticCreateWorkspaceTaskData,
            successData: successCreateWorkspaceTaskData,
            failureData: failureCreateWorkspaceTaskData,
        } = buildTaskData(createWorkspaceTaskReport, introSelected.createWorkspace);

        optimisticData.push(...optimisticCreateWorkspaceTaskData);
        successData.push(...successCreateWorkspaceTaskData);
        failureData.push(...failureCreateWorkspaceTaskData);
    }

    return {successData, optimisticData, failureData, params};
}

function createWorkspace(
    policyOwnerEmail = '',
    makeMeAdmin = false,
    policyName = '',
    policyID = generatePolicyID(),
    engagementChoice: OnboardingPurpose = CONST.ONBOARDING_CHOICES.MANAGE_TEAM,
    currency = '',
    file?: File,
    shouldAddOnboardingTasks = true,
    companySize?: OnboardingCompanySize,
    userReportedIntegration?: OnboardingAccounting,
): CreateWorkspaceParams {
    const {optimisticData, failureData, successData, params} = buildPolicyData({
        policyOwnerEmail,
        makeMeAdmin,
        policyName,
        policyID,
        engagementChoice,
        currency,
        file,
        shouldAddOnboardingTasks,
        companySize,
        userReportedIntegration,
    });

    API.write(WRITE_COMMANDS.CREATE_WORKSPACE, params, {optimisticData, successData, failureData});

    // Publish a workspace created event if this is their first policy
    if (getAdminPolicies().length === 0) {
        GoogleTagManager.publishEvent(CONST.ANALYTICS.EVENT.WORKSPACE_CREATED, sessionAccountID);
    }

    return params;
}

/**
 * Creates a draft workspace for various money request flows
 *
 * @param [policyOwnerEmail] the email of the account to make the owner of the policy
 * @param [makeMeAdmin] leave the calling account as an admin on the policy
 * @param [policyName] custom policy name we will use for created workspace
 * @param [policyID] custom policy id we will use for created workspace
 */
function createDraftWorkspace(policyOwnerEmail = '', makeMeAdmin = false, policyName = '', policyID = generatePolicyID(), currency = '', file?: File): CreateWorkspaceParams {
    const workspaceName = policyName || generateDefaultWorkspaceName(policyOwnerEmail);

    const {customUnits, customUnitID, customUnitRateID, outputCurrency} = buildOptimisticDistanceRateCustomUnits(currency);

    const {expenseChatData, adminsChatReportID, adminsCreatedReportActionID, expenseChatReportID, expenseCreatedReportActionID} = ReportUtils.buildOptimisticWorkspaceChats(
        policyID,
        workspaceName,
    );

    const shouldEnableWorkflowsByDefault =
        !introSelected?.choice || introSelected.choice === CONST.ONBOARDING_CHOICES.MANAGE_TEAM || introSelected.choice === CONST.ONBOARDING_CHOICES.LOOKING_AROUND;

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.POLICY_DRAFTS}${policyID}`,
            value: {
                id: policyID,
                type: CONST.POLICY.TYPE.TEAM,
                name: workspaceName,
                role: CONST.POLICY.ROLE.ADMIN,
                owner: sessionEmail,
                ownerAccountID: sessionAccountID,
                isPolicyExpenseChatEnabled: true,
                outputCurrency,
                pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                autoReporting: true,
                approver: sessionEmail,
                autoReportingFrequency: shouldEnableWorkflowsByDefault ? CONST.POLICY.AUTO_REPORTING_FREQUENCIES.IMMEDIATE : CONST.POLICY.AUTO_REPORTING_FREQUENCIES.INSTANT,
                harvesting: {
                    enabled: !shouldEnableWorkflowsByDefault,
                },
                approvalMode: shouldEnableWorkflowsByDefault ? CONST.POLICY.APPROVAL_MODE.BASIC : CONST.POLICY.APPROVAL_MODE.OPTIONAL,
                customUnits,
                areCategoriesEnabled: true,
                areWorkflowsEnabled: shouldEnableWorkflowsByDefault,
                areCompanyCardsEnabled: true,
                areTagsEnabled: false,
                areDistanceRatesEnabled: false,
                areReportFieldsEnabled: false,
                areConnectionsEnabled: false,
                areExpensifyCardsEnabled: false,
                employeeList: {
                    [sessionEmail]: {
                        submitsTo: sessionEmail,
                        email: sessionEmail,
                        role: CONST.POLICY.ROLE.ADMIN,
                        errors: {},
                    },
                },
                chatReportIDAdmins: makeMeAdmin ? Number(adminsChatReportID) : undefined,
                pendingFields: {
                    autoReporting: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    approvalMode: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    reimbursementChoice: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                },
                defaultBillable: false,
                disabledFields: {defaultBillable: true},
                requiresCategory: true,
            },
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_DRAFT}${expenseChatReportID}`,
            value: expenseChatData,
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.POLICY_CATEGORIES_DRAFT}${policyID}`,
            value: Object.values(CONST.POLICY.DEFAULT_CATEGORIES).reduce<Record<string, PolicyCategory>>((acc, category) => {
                acc[category] = {
                    name: category,
                    enabled: true,
                    errors: null,
                };
                return acc;
            }, {}),
        },
    ];

    // We need to clone the file to prevent non-indexable errors.
    const clonedFile = file ? (createFile(file) as File) : undefined;

    const params: CreateWorkspaceParams = {
        policyID,
        adminsChatReportID,
        expenseChatReportID,
        ownerEmail: policyOwnerEmail,
        makeMeAdmin,
        policyName: workspaceName,
        type: CONST.POLICY.TYPE.TEAM,
        adminsCreatedReportActionID,
        expenseCreatedReportActionID,
        customUnitID,
        customUnitRateID,
        currency: outputCurrency,
        file: clonedFile,
    };

    Onyx.update(optimisticData);

    return params;
}

function openPolicyWorkflowsPage(policyID: string) {
    if (!policyID) {
        Log.warn('openPolicyWorkflowsPage invalid params', {policyID});
        return;
    }

    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    isLoading: true,
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    isLoading: false,
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    isLoading: false,
                },
            },
        ],
    };

    const params: OpenPolicyWorkflowsPageParams = {policyID};

    API.read(READ_COMMANDS.OPEN_POLICY_WORKFLOWS_PAGE, params, onyxData);
}

/**
 * Returns the accountIDs of the members of the policy whose data is passed in the parameters
 */
function openWorkspace(policyID: string, clientMemberAccountIDs: number[]) {
    if (!policyID || !clientMemberAccountIDs) {
        Log.warn('openWorkspace invalid params', {policyID, clientMemberAccountIDs});
        return;
    }

    const params: OpenWorkspaceParams = {
        policyID,
        clientMemberAccountIDs: JSON.stringify(clientMemberAccountIDs),
    };

    API.read(READ_COMMANDS.OPEN_WORKSPACE, params);
}

function openPolicyTaxesPage(policyID: string) {
    if (!policyID) {
        Log.warn('openPolicyTaxesPage invalid params', {policyID});
        return;
    }

    const params: OpenPolicyTaxesPageParams = {
        policyID,
    };

    API.read(READ_COMMANDS.OPEN_POLICY_TAXES_PAGE, params);
}

function openPolicyExpensifyCardsPage(policyID: string, workspaceAccountID: number) {
    const authToken = NetworkStore.getAuthToken();

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.PRIVATE_EXPENSIFY_CARD_SETTINGS}${workspaceAccountID}`,
            value: {
                isLoading: true,
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.PRIVATE_EXPENSIFY_CARD_SETTINGS}${workspaceAccountID}`,
            value: {
                isLoading: false,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.PRIVATE_EXPENSIFY_CARD_SETTINGS}${workspaceAccountID}`,
            value: {
                isLoading: false,
            },
        },
    ];

    const params: OpenPolicyExpensifyCardsPageParams = {
        policyID,
        authToken,
    };

    API.read(READ_COMMANDS.OPEN_POLICY_EXPENSIFY_CARDS_PAGE, params, {optimisticData, successData, failureData});
}

function openPolicyEditCardLimitTypePage(policyID: string, cardID: number) {
    const authToken = NetworkStore.getAuthToken();

    const params: OpenPolicyEditCardLimitTypePageParams = {
        policyID,
        authToken,
        cardID,
    };

    API.read(READ_COMMANDS.OPEN_POLICY_EDIT_CARD_LIMIT_TYPE_PAGE, params);
}

function openWorkspaceInvitePage(policyID: string, clientMemberEmails: string[]) {
    if (!policyID || !clientMemberEmails) {
        Log.warn('openWorkspaceInvitePage invalid params', {policyID, clientMemberEmails});
        return;
    }

    const params: OpenWorkspaceInvitePageParams = {
        policyID,
        clientMemberEmails: JSON.stringify(clientMemberEmails),
    };

    API.read(READ_COMMANDS.OPEN_WORKSPACE_INVITE_PAGE, params);
}

function openDraftWorkspaceRequest(policyID: string) {
    if (policyID === '-1' || policyID === CONST.POLICY.ID_FAKE) {
        Log.warn('openDraftWorkspaceRequest invalid params', {policyID});
        return;
    }

    const params: OpenDraftWorkspaceRequestParams = {policyID};

    API.read(READ_COMMANDS.OPEN_DRAFT_WORKSPACE_REQUEST, params);
}

function requestExpensifyCardLimitIncrease(settlementBankAccountID?: number) {
    if (!settlementBankAccountID) {
        return;
    }

    const authToken = NetworkStore.getAuthToken();

    const params: RequestExpensifyCardLimitIncreaseParams = {
        authToken,
        settlementBankAccountID,
    };

    API.write(WRITE_COMMANDS.REQUEST_EXPENSIFY_CARD_LIMIT_INCREASE, params);
}

function updateMemberCustomField(policyID: string, login: string, customFieldType: CustomFieldType, value: string) {
    const customFieldKey = CONST.CUSTOM_FIELD_KEYS[customFieldType];
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const previousValue = policy?.employeeList?.[login]?.[customFieldKey];

    if (value === (previousValue ?? '')) {
        return;
    }

    const optimisticData: OnyxUpdate[] = [
        {
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            onyxMethod: Onyx.METHOD.MERGE,
            value: {
                employeeList: {[login]: {[customFieldKey]: value, pendingFields: {[customFieldKey]: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE}}},
            },
        },
    ];
    const successData: OnyxUpdate[] = [
        {
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            onyxMethod: Onyx.METHOD.MERGE,
            value: {
                employeeList: {[login]: {pendingFields: {[customFieldKey]: null}}},
            },
        },
    ];
    const failureData: OnyxUpdate[] = [
        {
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            onyxMethod: Onyx.METHOD.MERGE,
            value: {
                employeeList: {[login]: {[customFieldKey]: previousValue, pendingFields: {[customFieldKey]: null}}},
            },
        },
    ];

    const params: UpdatePolicyMembersCustomFieldsParams = {policyID, employees: JSON.stringify([{email: login, [customFieldType]: value}])};

    API.write(WRITE_COMMANDS.UPDATE_POLICY_MEMBERS_CUSTOM_FIELDS, params, {optimisticData, successData, failureData});
}

function setWorkspaceInviteMessageDraft(policyID: string, message: string | null) {
    Onyx.set(`${ONYXKEYS.COLLECTION.WORKSPACE_INVITE_MESSAGE_DRAFT}${policyID}`, message);
}

function clearErrors(policyID: string) {
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {errors: null});
    hideWorkspaceAlertMessage(policyID);
}

/**
 * Dismiss the informative messages about which policy members were added with primary logins when invited with their secondary login.
 */
function dismissAddedWithPrimaryLoginMessages(policyID: string) {
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {primaryLoginsInvited: null});
}

function buildOptimisticRecentlyUsedCurrencies(currency?: string) {
    if (!currency) {
        return [];
    }

    return lodashUnion([currency], allRecentlyUsedCurrencies).slice(0, CONST.IOU.MAX_RECENT_REPORTS_TO_SHOW);
}

/**
 * This flow is used for bottom up flow converting IOU report to an expense report. When user takes this action,
 * we create a Collect type workspace when the person taking the action becomes an owner and an admin, while we
 * add a new member to the workspace as an employee and convert the IOU report passed as a param into an expense report.
 *
 * @returns policyID of the workspace we have created
 */
// eslint-disable-next-line rulesdir/no-call-actions-from-actions
function createWorkspaceFromIOUPayment(iouReport: OnyxEntry<Report>): WorkspaceFromIOUCreationData | undefined {
    // This flow only works for IOU reports
    if (!ReportUtils.isIOUReportUsingReport(iouReport)) {
        return;
    }

    // Generate new variables for the policy
    const policyID = generatePolicyID();
    const workspaceName = generateDefaultWorkspaceName(sessionEmail);
    const employeeAccountID = iouReport.ownerAccountID;
    const {customUnits, customUnitID, customUnitRateID} = buildOptimisticDistanceRateCustomUnits(iouReport.currency);
    const oldPersonalPolicyID = iouReport.policyID;
    const iouReportID = iouReport.reportID;

    const {
        adminsChatReportID,
        adminsChatData,
        adminsReportActionData,
        adminsCreatedReportActionID,
        expenseChatReportID: workspaceChatReportID,
        expenseChatData: workspaceChatData,
        expenseReportActionData: workspaceChatReportActionData,
        expenseCreatedReportActionID: workspaceChatCreatedReportActionID,
        pendingChatMembers,
    } = ReportUtils.buildOptimisticWorkspaceChats(policyID, workspaceName);

    if (!employeeAccountID || !oldPersonalPolicyID) {
        return;
    }

    const employeeEmail = allPersonalDetails?.[employeeAccountID]?.login ?? '';

    // Create the expense chat for the employee whose IOU is being paid
    const employeeWorkspaceChat = createPolicyExpenseChats(policyID, {[employeeEmail]: employeeAccountID}, true);
    const newWorkspace = {
        id: policyID,

        // We are creating a collect policy in this case
        type: CONST.POLICY.TYPE.TEAM,
        name: workspaceName,
        role: CONST.POLICY.ROLE.ADMIN,
        owner: sessionEmail,
        ownerAccountID: sessionAccountID,
        isPolicyExpenseChatEnabled: true,

        // Setting the currency to USD as we can only add the VBBA for this policy currency right now
        outputCurrency: CONST.CURRENCY.USD,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        autoReporting: true,
        autoReportingFrequency: CONST.POLICY.AUTO_REPORTING_FREQUENCIES.IMMEDIATE,
        approvalMode: CONST.POLICY.APPROVAL_MODE.BASIC,
        approver: sessionEmail,
        harvesting: {
            enabled: false,
        },
        customUnits,
        areCategoriesEnabled: true,
        areCompanyCardsEnabled: true,
        areTagsEnabled: false,
        areDistanceRatesEnabled: false,
        areWorkflowsEnabled: true,
        areReportFieldsEnabled: false,
        areConnectionsEnabled: false,
        areExpensifyCardsEnabled: false,
        employeeList: {
            [sessionEmail]: {
                email: sessionEmail,
                submitsTo: sessionEmail,
                role: CONST.POLICY.ROLE.ADMIN,
                errors: {},
            },
            ...(employeeEmail
                ? {
                      [employeeEmail]: {
                          email: employeeEmail,
                          submitsTo: sessionEmail,
                          role: CONST.POLICY.ROLE.USER,
                          errors: {},
                      },
                  }
                : {}),
        },
        pendingFields: {
            autoReporting: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
            approvalMode: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
            reimbursementChoice: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        },
        defaultBillable: false,
        disabledFields: {defaultBillable: true},
        requiresCategory: true,
    };

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: newWorkspace,
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT}${adminsChatReportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                },
                ...adminsChatData,
            },
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${adminsChatReportID}`,
            value: {
                pendingChatMembers,
            },
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${adminsChatReportID}`,
            value: adminsReportActionData,
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT}${workspaceChatReportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                },
                ...workspaceChatData,
            },
        },
        {
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${workspaceChatReportID}`,
            value: workspaceChatReportActionData,
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY_DRAFTS}${policyID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: null,
                },
                pendingAction: null,
            },
        },
    ];
    optimisticData.push(...employeeWorkspaceChat.onyxOptimisticData);

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingAction: null,
                pendingFields: {
                    autoReporting: null,
                    approvalMode: null,
                    reimbursementChoice: null,
                },
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${adminsChatReportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: null,
                },
                pendingAction: null,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${adminsChatReportID}`,
            value: {
                isOptimisticReport: false,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${adminsChatReportID}`,
            value: {
                [Object.keys(adminsChatData).at(0) ?? '']: {
                    pendingAction: null,
                },
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${workspaceChatReportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: null,
                },
                pendingAction: null,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${workspaceChatReportID}`,
            value: {
                isOptimisticReport: false,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${workspaceChatReportID}`,
            value: {
                [Object.keys(workspaceChatData).at(0) ?? '']: {
                    pendingAction: null,
                },
            },
        },
    ];
    successData.push(...employeeWorkspaceChat.onyxSuccessData);

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${adminsChatReportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: null,
                },
                pendingAction: null,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${adminsChatReportID}`,
            value: {
                pendingAction: null,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${workspaceChatReportID}`,
            value: {
                pendingFields: {
                    addWorkspaceRoom: null,
                },
                pendingAction: null,
            },
        },
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${workspaceChatReportID}`,
            value: {
                pendingAction: null,
            },
        },
    ];

    // Compose the memberData object which is used to add the employee to the workspace and
    // optimistically create the expense chat for them.
    const memberData = {
        accountID: Number(employeeAccountID),
        email: employeeEmail,
        workspaceChatReportID: employeeWorkspaceChat.reportCreationData[employeeEmail].reportID,
        workspaceChatCreatedReportActionID: employeeWorkspaceChat.reportCreationData[employeeEmail].reportActionID,
    };

    const oldChatReportID = iouReport.chatReportID;

    // Next we need to convert the IOU report to Expense report.
    // We need to change:
    // - report type
    // - change the sign of the report total
    // - update its policyID and policyName
    // - update the chatReportID to point to the new expense chat
    const expenseReport = {
        ...iouReport,
        chatReportID: memberData.workspaceChatReportID,
        policyID,
        policyName: workspaceName,
        type: CONST.REPORT.TYPE.EXPENSE,
        total: -(iouReport?.total ?? 0),
    };
    optimisticData.push({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.REPORT}${iouReportID}`,
        value: expenseReport,
    });
    failureData.push({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.REPORT}${iouReportID}`,
        value: iouReport,
    });

    // The expense report transactions need to have the amount reversed to negative values
    const reportTransactions = ReportUtils.getReportTransactions(iouReportID);

    // For performance reasons, we are going to compose a merge collection data for transactions
    const transactionsOptimisticData: Record<string, Transaction> = {};
    const transactionFailureData: Record<string, Transaction> = {};
    reportTransactions.forEach((transaction) => {
        transactionsOptimisticData[`${ONYXKEYS.COLLECTION.TRANSACTION}${transaction.transactionID}`] = {
            ...transaction,
            amount: -transaction.amount,
            modifiedAmount: transaction.modifiedAmount ? -transaction.modifiedAmount : 0,
        };

        transactionFailureData[`${ONYXKEYS.COLLECTION.TRANSACTION}${transaction.transactionID}`] = transaction;
    });

    optimisticData.push({
        onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
        key: `${ONYXKEYS.COLLECTION.TRANSACTION}`,
        value: transactionsOptimisticData,
    });
    failureData.push({
        onyxMethod: Onyx.METHOD.MERGE_COLLECTION,
        key: `${ONYXKEYS.COLLECTION.TRANSACTION}`,
        value: transactionFailureData,
    });

    // We need to move the report preview action from the DM to the expense chat.
    const parentReport = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${iouReport.parentReportID}`];
    const parentReportActionID = iouReport.parentReportActionID;
    const reportPreview = iouReport?.parentReportID && parentReportActionID ? parentReport?.[parentReportActionID] : undefined;

    if (reportPreview?.reportActionID) {
        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${oldChatReportID}`,
            value: {[reportPreview.reportActionID]: null},
        });
        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${oldChatReportID}`,
            value: {[reportPreview.reportActionID]: reportPreview},
        });
    }

    // To optimistically remove the GBR from the DM we need to update the hasOutstandingChildRequest param to false
    optimisticData.push({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.REPORT}${oldChatReportID}`,
        value: {
            hasOutstandingChildRequest: false,
        },
    });
    failureData.push({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.REPORT}${oldChatReportID}`,
        value: {
            hasOutstandingChildRequest: true,
        },
    });

    if (reportPreview?.reportActionID) {
        // Update the created timestamp of the report preview action to be after the expense chat created timestamp.
        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${memberData.workspaceChatReportID}`,
            value: {
                [reportPreview.reportActionID]: {
                    ...reportPreview,
                    message: [
                        {
                            type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                            text: ReportUtils.getReportPreviewMessage(expenseReport, null, false, false, newWorkspace),
                        },
                    ],
                    created: DateUtils.getDBTime(),
                },
            },
        });
        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${memberData.workspaceChatReportID}`,
            value: {[reportPreview.reportActionID]: null},
        });
    }

    // Create the MOVED report action and add it to the DM chat which indicates to the user where the report has been moved
    const movedReportAction = ReportUtils.buildOptimisticMovedReportAction(oldPersonalPolicyID, policyID, memberData.workspaceChatReportID, iouReportID, workspaceName, true);

    const movedIouReportAction = ReportUtils.buildOptimisticMovedReportAction(oldPersonalPolicyID, policyID, memberData.workspaceChatReportID, iouReportID, workspaceName);

    optimisticData.push({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${iouReport.reportID}`,
        value: {[movedIouReportAction.reportActionID]: movedIouReportAction},
    });

    successData.push({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${iouReport.reportID}`,
        value: {
            [movedIouReportAction.reportActionID]: {
                ...movedIouReportAction,
                pendingAction: null,
            },
        },
    });

    failureData.push({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${iouReport.reportID}`,
        value: {[movedIouReportAction.reportActionID]: null},
    });

    optimisticData.push({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${oldChatReportID}`,
        value: {[movedReportAction.reportActionID]: movedReportAction},
    });
    successData.push({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${oldChatReportID}`,
        value: {
            [movedReportAction.reportActionID]: {
                ...movedReportAction,
                pendingAction: null,
            },
        },
    });
    failureData.push({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${oldChatReportID}`,
        value: {[movedReportAction.reportActionID]: null},
    });

    // We know that this new workspace has no BankAccount yet, so we can set
    // the reimbursement account to be immediately in the setup state for a new bank account:
    optimisticData.push({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.REIMBURSEMENT_ACCOUNT}`,
        value: {
            isLoading: false,
            achData: {
                currentStep: CONST.BANK_ACCOUNT.STEP.BANK_ACCOUNT,
                policyID,
                subStep: '',
            },
        },
    });
    failureData.push({
        onyxMethod: Onyx.METHOD.SET,
        key: `${ONYXKEYS.REIMBURSEMENT_ACCOUNT}`,
        value: CONST.REIMBURSEMENT_ACCOUNT.DEFAULT_DATA,
    });

    const params: CreateWorkspaceFromIOUPaymentParams = {
        policyID,
        adminsChatReportID,
        expenseChatReportID: workspaceChatReportID,
        ownerEmail: '',
        makeMeAdmin: false,
        policyName: workspaceName,
        type: CONST.POLICY.TYPE.TEAM,
        adminsCreatedReportActionID,
        expenseCreatedReportActionID: workspaceChatCreatedReportActionID,
        customUnitID,
        customUnitRateID,
        iouReportID,
        memberData: JSON.stringify(memberData),
        reportActionID: movedReportAction.reportActionID,
        expenseMovedReportActionID: movedIouReportAction.reportActionID,
    };

    API.write(WRITE_COMMANDS.CREATE_WORKSPACE_FROM_IOU_PAYMENT, params, {optimisticData, successData, failureData});

    return {policyID, workspaceChatReportID: memberData.workspaceChatReportID, reportPreviewReportActionID: reportPreview?.reportActionID, adminsChatReportID};
}

function enablePolicyConnections(policyID: string, enabled: boolean) {
    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areConnectionsEnabled: enabled,
                    pendingFields: {
                        areConnectionsEnabled: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        areConnectionsEnabled: null,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areConnectionsEnabled: !enabled,
                    pendingFields: {
                        areConnectionsEnabled: null,
                    },
                },
            },
        ],
    };

    const parameters: EnablePolicyConnectionsParams = {policyID, enabled};

    API.writeWithNoDuplicatesEnableFeatureConflicts(WRITE_COMMANDS.ENABLE_POLICY_CONNECTIONS, parameters, onyxData);

    if (enabled && getIsNarrowLayout()) {
        goBackWhenEnableFeature(policyID);
    }
}

/** Save the preferred export method for a policy */
function savePreferredExportMethod(policyID: string, exportMethod: ReportExportType) {
    Onyx.merge(`${ONYXKEYS.LAST_EXPORT_METHOD}`, {[policyID]: exportMethod});
}

function enableExpensifyCard(policyID: string, enabled: boolean, shouldNavigateToExpensifyCardPage = false) {
    const authToken = NetworkStore.getAuthToken();
    if (!authToken) {
        return;
    }
    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areExpensifyCardsEnabled: enabled,
                    pendingFields: {
                        areExpensifyCardsEnabled: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        areExpensifyCardsEnabled: null,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areExpensifyCardsEnabled: !enabled,
                    pendingFields: {
                        areExpensifyCardsEnabled: null,
                    },
                },
            },
        ],
    };

    const parameters: EnablePolicyExpensifyCardsParams = {authToken, policyID, enabled};

    API.writeWithNoDuplicatesEnableFeatureConflicts(WRITE_COMMANDS.ENABLE_POLICY_EXPENSIFY_CARDS, parameters, onyxData);

    if (enabled && shouldNavigateToExpensifyCardPage) {
        navigateToExpensifyCardPage(policyID);
        return;
    }

    if (enabled && getIsNarrowLayout()) {
        goBackWhenEnableFeature(policyID);
    }
}

function enableCompanyCards(policyID: string, enabled: boolean, shouldGoBack = true) {
    const authToken = NetworkStore.getAuthToken();

    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areCompanyCardsEnabled: enabled,
                    pendingFields: {
                        areCompanyCardsEnabled: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        areCompanyCardsEnabled: null,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areCompanyCardsEnabled: !enabled,
                    pendingFields: {
                        areCompanyCardsEnabled: null,
                    },
                },
            },
        ],
    };

    const parameters: EnablePolicyCompanyCardsParams = {authToken, policyID, enabled};

    API.writeWithNoDuplicatesEnableFeatureConflicts(WRITE_COMMANDS.ENABLE_POLICY_COMPANY_CARDS, parameters, onyxData);

    if (enabled && getIsNarrowLayout() && shouldGoBack) {
        goBackWhenEnableFeature(policyID);
    }
}

function enablePolicyReportFields(policyID: string, enabled: boolean) {
    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areReportFieldsEnabled: enabled,
                    pendingFields: {
                        areReportFieldsEnabled: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        areReportFieldsEnabled: null,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areReportFieldsEnabled: !enabled,
                    pendingFields: {
                        areReportFieldsEnabled: null,
                    },
                },
            },
        ],
    };

    const parameters: EnablePolicyReportFieldsParams = {policyID, enabled};

    API.writeWithNoDuplicatesEnableFeatureConflicts(WRITE_COMMANDS.ENABLE_POLICY_REPORT_FIELDS, parameters, onyxData);
}

function enablePolicyTaxes(policyID: string, enabled: boolean) {
    const defaultTaxRates: TaxRatesWithDefault = CONST.DEFAULT_TAX;
    const taxRatesData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        ...defaultTaxRates,
                        taxes: {
                            ...Object.keys(defaultTaxRates.taxes).reduce(
                                (acc, taxKey) => {
                                    acc[taxKey] = {
                                        ...defaultTaxRates.taxes[taxKey],
                                        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                                    };
                                    return acc;
                                },
                                {} as Record<string, TaxRate & {pendingAction: typeof CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD}>,
                            ),
                        },
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        taxes: {
                            ...Object.keys(defaultTaxRates.taxes).reduce(
                                (acc, taxKey) => {
                                    acc[taxKey] = {pendingAction: null};
                                    return acc;
                                },
                                {} as Record<string, {pendingAction: null}>,
                            ),
                        },
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: undefined,
                },
            },
        ],
    };
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const shouldAddDefaultTaxRatesData = (!policy?.taxRates || isEmptyObject(policy.taxRates)) && enabled;

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                tax: {
                    trackingEnabled: enabled,
                },
                pendingFields: {
                    tax: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                },
            },
        },
    ];
    optimisticData.push(...(shouldAddDefaultTaxRatesData ? (taxRatesData.optimisticData ?? []) : []));

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingFields: {
                    tax: null,
                },
            },
        },
    ];
    successData.push(...(shouldAddDefaultTaxRatesData ? (taxRatesData.successData ?? []) : []));

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                tax: {
                    trackingEnabled: !enabled,
                },
                pendingFields: {
                    tax: null,
                },
            },
        },
    ];
    failureData.push(...(shouldAddDefaultTaxRatesData ? (taxRatesData.failureData ?? []) : []));

    const onyxData: OnyxData = {
        optimisticData,
        successData,
        failureData,
    };

    const parameters: EnablePolicyTaxesParams = {policyID, enabled};
    if (shouldAddDefaultTaxRatesData) {
        parameters.taxFields = JSON.stringify(defaultTaxRates);
    }
    API.writeWithNoDuplicatesEnableFeatureConflicts(WRITE_COMMANDS.ENABLE_POLICY_TAXES, parameters, onyxData);

    if (enabled && getIsNarrowLayout()) {
        goBackWhenEnableFeature(policyID);
    }
}

function enablePolicyWorkflows(policyID: string, enabled: boolean) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areWorkflowsEnabled: enabled,
                    ...(!enabled
                        ? {
                              approvalMode: CONST.POLICY.APPROVAL_MODE.OPTIONAL,
                              autoReporting: false,
                              autoReportingFrequency: CONST.POLICY.AUTO_REPORTING_FREQUENCIES.INSTANT,
                              harvesting: {
                                  enabled: false,
                              },
                              reimbursementChoice: CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_NO,
                          }
                        : {}),
                    pendingFields: {
                        areWorkflowsEnabled: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                        ...(!enabled
                            ? {
                                  approvalMode: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                                  autoReporting: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                                  autoReportingFrequency: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                                  harvesting: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                                  reimbursementChoice: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                              }
                            : {}),
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        areWorkflowsEnabled: null,
                        ...(!enabled
                            ? {
                                  approvalMode: null,
                                  autoReporting: null,
                                  autoReportingFrequency: null,
                                  harvesting: null,
                                  reimbursementChoice: null,
                              }
                            : {}),
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areWorkflowsEnabled: !enabled,
                    ...(!enabled
                        ? {
                              approvalMode: policy?.approvalMode,
                              autoReporting: policy?.autoReporting,
                              autoReportingFrequency: policy?.autoReportingFrequency,
                              harvesting: policy?.harvesting,
                              reimbursementChoice: policy?.reimbursementChoice,
                          }
                        : {}),
                    pendingFields: {
                        areWorkflowsEnabled: null,
                        ...(!enabled
                            ? {
                                  approvalMode: null,
                                  autoReporting: null,
                                  autoReportingFrequency: null,
                                  harvesting: null,
                                  reimbursementChoice: null,
                              }
                            : {}),
                    },
                },
            },
        ],
    };

    const parameters: EnablePolicyWorkflowsParams = {policyID, enabled};

    // When disabling workflows, set autoreporting back to "immediately"
    if (!enabled) {
        setWorkspaceAutoReportingFrequency(policyID, CONST.POLICY.AUTO_REPORTING_FREQUENCIES.INSTANT);
    }

    API.writeWithNoDuplicatesEnableFeatureConflicts(WRITE_COMMANDS.ENABLE_POLICY_WORKFLOWS, parameters, onyxData);

    if (enabled && getIsNarrowLayout()) {
        goBackWhenEnableFeature(policyID);
    }
}

const DISABLED_MAX_EXPENSE_VALUES: Pick<Policy, 'maxExpenseAmountNoReceipt' | 'maxExpenseAmount' | 'maxExpenseAge'> = {
    maxExpenseAmountNoReceipt: CONST.DISABLED_MAX_EXPENSE_VALUE,
    maxExpenseAmount: CONST.DISABLED_MAX_EXPENSE_VALUE,
    maxExpenseAge: CONST.DISABLED_MAX_EXPENSE_VALUE,
};

function enablePolicyRules(policyID: string, enabled: boolean, shouldGoBack = true) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areRulesEnabled: enabled,
                    preventSelfApproval: false,
                    ...(!enabled ? DISABLED_MAX_EXPENSE_VALUES : {}),
                    pendingFields: {
                        areRulesEnabled: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        areRulesEnabled: null,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areRulesEnabled: !enabled,
                    preventSelfApproval: policy?.preventSelfApproval,
                    ...(!enabled
                        ? {
                              maxExpenseAmountNoReceipt: policy?.maxExpenseAmountNoReceipt,
                              maxExpenseAmount: policy?.maxExpenseAmount,
                              maxExpenseAge: policy?.maxExpenseAge,
                          }
                        : {}),
                    pendingFields: {
                        areRulesEnabled: null,
                    },
                },
            },
        ],
    };

    if (enabled && isControlPolicy(policy) && policy?.outputCurrency === CONST.CURRENCY.USD) {
        const eReceiptsOnyxData = getWorkspaceEReceiptsEnabledOnyxData(policyID, enabled);
        onyxData.optimisticData?.push(...(eReceiptsOnyxData.optimisticData ?? []));
        onyxData.successData?.push(...(eReceiptsOnyxData.successData ?? []));
        onyxData.failureData?.push(...(eReceiptsOnyxData.failureData ?? []));
    }

    const parameters: SetPolicyRulesEnabledParams = {policyID, enabled};
    API.writeWithNoDuplicatesEnableFeatureConflicts(WRITE_COMMANDS.SET_POLICY_RULES_ENABLED, parameters, onyxData);

    if (enabled && getIsNarrowLayout() && shouldGoBack) {
        goBackWhenEnableFeature(policyID);
    }
}

function enableDistanceRequestTax(policyID: string, customUnitName: string, customUnitID: string, attributes: Attributes) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    customUnits: {
                        [customUnitID]: {
                            attributes,
                            pendingFields: {
                                taxEnabled: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                            },
                        },
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    customUnits: {
                        [customUnitID]: {
                            pendingFields: {
                                taxEnabled: null,
                            },
                        },
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    customUnits: {
                        [customUnitID]: {
                            attributes: policy?.customUnits ? policy?.customUnits[customUnitID].attributes : null,
                            errorFields: {
                                taxEnabled: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage'),
                            },
                        },
                    },
                },
            },
        ],
    };

    const params = {
        policyID,
        customUnit: JSON.stringify({
            customUnitName,
            customUnitID,
            attributes,
        }),
    };
    API.write(WRITE_COMMANDS.ENABLE_DISTANCE_REQUEST_TAX, params, onyxData);
}

function enablePolicyInvoicing(policyID: string, enabled: boolean) {
    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areInvoicesEnabled: enabled,
                    pendingFields: {
                        areInvoicesEnabled: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        areInvoicesEnabled: null,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    areInvoicesEnabled: !enabled,
                    pendingFields: {
                        areInvoicesEnabled: null,
                    },
                },
            },
        ],
    };

    const parameters: EnablePolicyInvoicingParams = {policyID, enabled};

    API.writeWithNoDuplicatesEnableFeatureConflicts(WRITE_COMMANDS.ENABLE_POLICY_INVOICING, parameters, onyxData);

    if (enabled && getIsNarrowLayout()) {
        goBackWhenEnableFeature(policyID);
    }
}

function openPolicyMoreFeaturesPage(policyID: string) {
    const params: OpenPolicyMoreFeaturesPageParams = {policyID};

    API.read(READ_COMMANDS.OPEN_POLICY_MORE_FEATURES_PAGE, params);
}

function openPolicyProfilePage(policyID: string) {
    const params: OpenPolicyProfilePageParams = {policyID};

    API.read(READ_COMMANDS.OPEN_POLICY_PROFILE_PAGE, params);
}

function openPolicyInitialPage(policyID: string) {
    const params: OpenPolicyInitialPageParams = {policyID};

    API.read(READ_COMMANDS.OPEN_POLICY_INITIAL_PAGE, params);
}

function setPolicyCustomTaxName(policyID: string, customTaxName: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const originalCustomTaxName = policy?.taxRates?.name;
    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        name: customTaxName,
                        pendingFields: {name: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE},
                        errorFields: null,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        pendingFields: {name: null},
                        errorFields: null,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        name: originalCustomTaxName,
                        pendingFields: {name: null},
                        errorFields: {name: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
                    },
                },
            },
        ],
    };

    const parameters = {
        policyID,
        customTaxName,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_CUSTOM_TAX_NAME, parameters, onyxData);
}

function setWorkspaceCurrencyDefault(policyID: string, taxCode: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const originalDefaultExternalID = policy?.taxRates?.defaultExternalID;
    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        defaultExternalID: taxCode,
                        pendingFields: {defaultExternalID: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE},
                        errorFields: null,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        pendingFields: {defaultExternalID: null},
                        errorFields: null,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        defaultExternalID: originalDefaultExternalID,
                        pendingFields: {defaultExternalID: null},
                        errorFields: {defaultExternalID: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
                    },
                },
            },
        ],
    };

    const parameters = {
        policyID,
        taxCode,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_TAXES_CURRENCY_DEFAULT, parameters, onyxData);
}

function setForeignCurrencyDefault(policyID: string, taxCode: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const originalDefaultForeignCurrencyID = policy?.taxRates?.foreignTaxDefault;
    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        foreignTaxDefault: taxCode,
                        pendingFields: {foreignTaxDefault: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE},
                        errorFields: null,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        pendingFields: {foreignTaxDefault: null},
                        errorFields: null,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        foreignTaxDefault: originalDefaultForeignCurrencyID,
                        pendingFields: {foreignTaxDefault: null},
                        errorFields: {foreignTaxDefault: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
                    },
                },
            },
        ],
    };

    const parameters = {
        policyID,
        taxCode,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_TAXES_FOREIGN_CURRENCY_DEFAULT, parameters, onyxData);
}

function upgradeToCorporate(policyID: string, featureName?: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `policy_${policyID}`,
            value: {
                isPendingUpgrade: true,
                type: CONST.POLICY.TYPE.CORPORATE,
                maxExpenseAge: CONST.POLICY.DEFAULT_MAX_EXPENSE_AGE,
                maxExpenseAmount: CONST.POLICY.DEFAULT_MAX_EXPENSE_AMOUNT,
                maxExpenseAmountNoReceipt: CONST.POLICY.DEFAULT_MAX_AMOUNT_NO_RECEIPT,
                glCodes: true,
                harvesting: {
                    enabled: false,
                },
                isAttendeeTrackingEnabled: false,
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `policy_${policyID}`,
            value: {
                isPendingUpgrade: false,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `policy_${policyID}`,
            value: {
                isPendingUpgrade: false,
                type: policy?.type,
                maxExpenseAge: policy?.maxExpenseAge ?? null,
                maxExpenseAmount: policy?.maxExpenseAmount ?? null,
                maxExpenseAmountNoReceipt: policy?.maxExpenseAmountNoReceipt ?? null,
                glCodes: policy?.glCodes ?? null,
                harvesting: policy?.harvesting ?? null,
                isAttendeeTrackingEnabled: null,
            },
        },
    ];

    const parameters: UpgradeToCorporateParams = {policyID, ...(featureName ? {featureName} : {})};

    API.write(WRITE_COMMANDS.UPGRADE_TO_CORPORATE, parameters, {optimisticData, successData, failureData});
}

function downgradeToTeam(policyID: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `policy_${policyID}`,
            value: {
                isPendingDowngrade: true,
                type: CONST.POLICY.TYPE.TEAM,
                isAttendeeTrackingEnabled: null,
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `policy_${policyID}`,
            value: {
                isPendingDowngrade: false,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `policy_${policyID}`,
            value: {
                isPendingDowngrade: false,
                type: policy?.type,
                isAttendeeTrackingEnabled: policy?.isAttendeeTrackingEnabled,
            },
        },
    ];

    const parameters: DowngradeToTeamParams = {policyID};

    API.write(WRITE_COMMANDS.DOWNGRADE_TO_TEAM, parameters, {optimisticData, successData, failureData});
}

function setWorkspaceDefaultSpendCategory(policyID: string, groupID: string, category: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    if (!policy) {
        return;
    }

    const {mccGroup} = policy;

    const optimisticData: OnyxUpdate[] = mccGroup
        ? [
              {
                  onyxMethod: Onyx.METHOD.MERGE,
                  key: `policy_${policyID}`,
                  value: {
                      mccGroup: {
                          ...mccGroup,
                          [groupID]: {
                              category,
                              groupID,
                              pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                          },
                      },
                  },
              },
          ]
        : [];

    const failureData: OnyxUpdate[] = mccGroup
        ? [
              {
                  onyxMethod: Onyx.METHOD.MERGE,
                  key: `policy_${policyID}`,
                  value: {
                      mccGroup: {
                          ...mccGroup,
                          [groupID]: {
                              ...mccGroup[groupID],
                              pendingAction: null,
                          },
                      },
                  },
              },
          ]
        : [];

    const successData: OnyxUpdate[] = mccGroup
        ? [
              {
                  onyxMethod: Onyx.METHOD.MERGE,
                  key: `policy_${policyID}`,
                  value: {
                      mccGroup: {
                          [groupID]: {
                              pendingAction: null,
                          },
                      },
                  },
              },
          ]
        : [];

    API.write(WRITE_COMMANDS.SET_WORKSPACE_DEFAULT_SPEND_CATEGORY, {policyID, groupID, category}, {optimisticData, successData, failureData});
}
/**
 * Call the API to set the receipt required amount for the given policy
 * @param policyID - id of the policy to set the receipt required amount
 * @param maxExpenseAmountNoReceipt - new value of the receipt required amount
 */
function setPolicyMaxExpenseAmountNoReceipt(policyID: string, maxExpenseAmountNoReceipt: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const parsedMaxExpenseAmountNoReceipt = maxExpenseAmountNoReceipt === '' ? CONST.DISABLED_MAX_EXPENSE_VALUE : CurrencyUtils.convertToBackendAmount(parseFloat(maxExpenseAmountNoReceipt));
    const originalMaxExpenseAmountNoReceipt = policy?.maxExpenseAmountNoReceipt;

    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    maxExpenseAmountNoReceipt: parsedMaxExpenseAmountNoReceipt,
                    pendingFields: {
                        maxExpenseAmountNoReceipt: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {maxExpenseAmountNoReceipt: null},
                    errorFields: null,
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    maxExpenseAmountNoReceipt: originalMaxExpenseAmountNoReceipt,
                    pendingFields: {maxExpenseAmountNoReceipt: null},
                    errorFields: {maxExpenseAmountNoReceipt: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
                },
            },
        ],
    };

    const parameters = {
        policyID,
        maxExpenseAmountNoReceipt: parsedMaxExpenseAmountNoReceipt,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_EXPENSE_MAX_AMOUNT_NO_RECEIPT, parameters, onyxData);
}

/**
 * Call the API to set the max expense amount for the given policy
 * @param policyID - id of the policy to set the max expense amount
 * @param maxExpenseAmount - new value of the max expense amount
 */
function setPolicyMaxExpenseAmount(policyID: string, maxExpenseAmount: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const parsedMaxExpenseAmount = maxExpenseAmount === '' ? CONST.DISABLED_MAX_EXPENSE_VALUE : CurrencyUtils.convertToBackendAmount(parseFloat(maxExpenseAmount));
    const originalMaxExpenseAmount = policy?.maxExpenseAmount;

    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    maxExpenseAmount: parsedMaxExpenseAmount,
                    pendingFields: {
                        maxExpenseAmount: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {maxExpenseAmount: null},
                    errorFields: null,
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    maxExpenseAmount: originalMaxExpenseAmount,
                    pendingFields: {maxExpenseAmount: null},
                    errorFields: {maxExpenseAmount: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
                },
            },
        ],
    };

    const parameters = {
        policyID,
        maxExpenseAmount: parsedMaxExpenseAmount,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_EXPENSE_MAX_AMOUNT, parameters, onyxData);
}

/**
 *
 * @param policyID
 * @param prohibitedExpense
 */
function setPolicyProhibitedExpense(policyID: string, prohibitedExpense: keyof ProhibitedExpenses) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const originalProhibitedExpenses = policy?.prohibitedExpenses;
    const prohibitedExpenses = {
        ...originalProhibitedExpenses,
        [prohibitedExpense]: !originalProhibitedExpenses?.[prohibitedExpense],
    };

    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    prohibitedExpenses: {
                        ...prohibitedExpenses,
                        pendingFields: {
                            [prohibitedExpense]: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                        },
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    prohibitedExpenses: {
                        pendingFields: {
                            [prohibitedExpense]: null,
                        },
                    },
                    errorFields: null,
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    prohibitedExpenses: originalProhibitedExpenses,
                    errorFields: {prohibitedExpenses: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
                },
            },
        ],
    };

    // Remove pendingFields before sending to the API
    const {pendingFields, ...prohibitedExpensesWithoutPendingFields} = prohibitedExpenses;
    const parameters: SetPolicyProhibitedExpensesParams = {
        policyID,
        prohibitedExpenses: JSON.stringify(prohibitedExpensesWithoutPendingFields),
    };

    API.write(WRITE_COMMANDS.SET_POLICY_PROHIBITED_EXPENSES, parameters, onyxData);
}

/**
 * Call the API to set the max expense age for the given policy
 * @param policyID - id of the policy to set the max expense age
 * @param maxExpenseAge - the max expense age value given in days
 */
function setPolicyMaxExpenseAge(policyID: string, maxExpenseAge: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const parsedMaxExpenseAge = maxExpenseAge === '' ? CONST.DISABLED_MAX_EXPENSE_VALUE : parseInt(maxExpenseAge, 10);
    const originalMaxExpenseAge = policy?.maxExpenseAge;

    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    maxExpenseAge: parsedMaxExpenseAge,
                    pendingFields: {
                        maxExpenseAge: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        maxExpenseAge: null,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    maxExpenseAge: originalMaxExpenseAge,
                    pendingFields: {maxExpenseAge: null},
                    errorFields: {maxExpenseAge: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
                },
            },
        ],
    };

    const parameters = {
        policyID,
        maxExpenseAge: parsedMaxExpenseAge,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_EXPENSE_MAX_AGE, parameters, onyxData);
}

/**
 * Call the API to set the custom rules for the given policy
 * @param policyID - id of the policy to set the max expense age
 * @param customRules - the custom rules description in natural language
 */
function updateCustomRules(policyID: string, customRules: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const originalCustomRules = policy?.customRules;
    const parsedCustomRules = ReportUtils.getParsedComment(customRules);
    if (parsedCustomRules === originalCustomRules) {
        return;
    }

    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    customRules: parsedCustomRules,
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        // TODO
                        // maxExpenseAge: null,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    customRules: originalCustomRules,
                    // TODO
                    // pendingFields: {maxExpenseAge: null},
                    // errorFields: {maxExpenseAge: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
                },
            },
        ],
    };

    const parameters = {
        policyID,
        description: parsedCustomRules,
    };

    API.write(WRITE_COMMANDS.UPDATE_CUSTOM_RULES, parameters, onyxData);
}

/**
 * Call the API to enable or disable the billable mode for the given policy
 * @param policyID - id of the policy to enable or disable the billable mode
 * @param defaultBillable - whether the billable mode is enabled in the given policy
 */
function setPolicyBillableMode(policyID: string, defaultBillable: boolean) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    const originalDefaultBillable = policy?.defaultBillable;
    const originalDefaultBillableDisabled = policy?.disabledFields?.defaultBillable;

    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    defaultBillable,
                    disabledFields: {
                        defaultBillable: false,
                    },
                    pendingFields: {
                        defaultBillable: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                        disabledFields: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        defaultBillable: null,
                        disabledFields: null,
                    },
                    errorFields: null,
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    disabledFields: {defaultBillable: originalDefaultBillableDisabled},
                    defaultBillable: originalDefaultBillable,
                    pendingFields: {defaultBillable: null, disabledFields: null},
                    errorFields: {defaultBillable: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
                },
            },
        ],
    };

    const parameters: SetPolicyBillableModeParams = {
        policyID,
        defaultBillable,
        disabledFields: JSON.stringify({
            defaultBillable: false,
        }),
    };

    API.write(WRITE_COMMANDS.SET_POLICY_BILLABLE_MODE, parameters, onyxData);
}

/**
 * Call the API to disable the billable mode for the given policy
 * @param policyID - id of the policy to enable or disable the billable mode
 */
function disableWorkspaceBillableExpenses(policyID: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const originalDefaultBillableDisabled = policy?.disabledFields?.defaultBillable;

    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    disabledFields: {
                        defaultBillable: true,
                    },
                    pendingFields: {
                        disabledFields: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        disabledFields: null,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {disabledFields: null},
                    disabledFields: {defaultBillable: originalDefaultBillableDisabled},
                },
            },
        ],
    };

    const parameters: DisablePolicyBillableModeParams = {
        policyID,
    };

    API.write(WRITE_COMMANDS.DISABLE_POLICY_BILLABLE_MODE, parameters, onyxData);
}

function getWorkspaceEReceiptsEnabledOnyxData(policyID: string, enabled: boolean): OnyxData {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    const originalEReceipts = policy?.eReceipts;
    return {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    eReceipts: enabled,
                    pendingFields: {
                        eReceipts: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        eReceipts: null,
                    },
                    errorFields: null,
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    eReceipts: originalEReceipts,
                    pendingFields: {defaultBillable: null},
                    errorFields: {defaultBillable: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
                },
            },
        ],
    };
}

function setWorkspaceEReceiptsEnabled(policyID: string, enabled: boolean) {
    const onyxData: OnyxData = getWorkspaceEReceiptsEnabledOnyxData(policyID, enabled);

    const parameters = {
        policyID,
        enabled,
    };

    API.write(WRITE_COMMANDS.SET_WORKSPACE_ERECEIPTS_ENABLED, parameters, onyxData);
}

function setPolicyAttendeeTrackingEnabled(policyID: string, isAttendeeTrackingEnabled: boolean) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    const originalIsAttendeeTrackingEnabled = !!policy?.isAttendeeTrackingEnabled;

    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    isAttendeeTrackingEnabled,
                    pendingFields: {
                        isAttendeeTrackingEnabled: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    pendingFields: {
                        isAttendeeTrackingEnabled: null,
                    },
                    errorFields: null,
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    isAttendeeTrackingEnabled: originalIsAttendeeTrackingEnabled,
                    pendingFields: {isAttendeeTrackingEnabled: null},
                    errorFields: {isAttendeeTrackingEnabled: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage')},
                },
            },
        ],
    };

    const parameters = {
        policyID,
        enabled: isAttendeeTrackingEnabled,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_ATTENDEE_TRACKING_ENABLED, parameters, onyxData);
}

function getAdminPolicies(): Policy[] {
    return Object.values(allPolicies ?? {}).filter<Policy>((policy): policy is Policy => !!policy && policy.role === CONST.POLICY.ROLE.ADMIN && policy.type !== CONST.POLICY.TYPE.PERSONAL);
}

function getAdminPoliciesConnectedToSageIntacct(): Policy[] {
    return Object.values(allPolicies ?? {}).filter<Policy>((policy): policy is Policy => !!policy && policy.role === CONST.POLICY.ROLE.ADMIN && !!policy?.connections?.intacct);
}

function getAdminPoliciesConnectedToNetSuite(): Policy[] {
    return Object.values(allPolicies ?? {}).filter<Policy>((policy): policy is Policy => !!policy && policy.role === CONST.POLICY.ROLE.ADMIN && !!policy?.connections?.netsuite);
}

/**
 * Call the API to set default report title pattern for the given policy
 * @param policyID - id of the policy to apply the naming pattern to
 * @param customName - name pattern to be used for the reports
 */
function setPolicyDefaultReportTitle(policyID: string, customName: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    if (customName === policy?.fieldList?.[CONST.POLICY.FIELDS.FIELD_LIST_TITLE]?.defaultValue) {
        return;
    }

    const previousReportTitleField = policy?.fieldList?.[CONST.POLICY.FIELDS.FIELD_LIST_TITLE] ?? {};

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                fieldList: {
                    [CONST.POLICY.FIELDS.FIELD_LIST_TITLE]: {
                        defaultValue: customName,
                        pendingFields: {defaultValue: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE},
                    },
                },
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                fieldList: {
                    [CONST.POLICY.FIELDS.FIELD_LIST_TITLE]: {pendingFields: {defaultValue: null}},
                },
                errorFields: null,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                fieldList: {
                    [CONST.POLICY.FIELDS.FIELD_LIST_TITLE]: {...previousReportTitleField, pendingFields: {defaultValue: null}},
                },
                errorFields: {
                    fieldList: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage'),
                },
            },
        },
    ];

    const parameters: SetPolicyDefaultReportTitleParams = {
        value: customName,
        policyID,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_DEFAULT_REPORT_TITLE, parameters, {
        optimisticData,
        successData,
        failureData,
    });
}

/**
 * Call the API to enable or disable enforcing the naming pattern for member created reports on a policy
 * @param policyID - id of the policy to apply the naming pattern to
 * @param enforced - flag whether to enforce policy name
 */
function setPolicyPreventMemberCreatedTitle(policyID: string, enforced: boolean) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    if (!enforced === policy?.fieldList?.[CONST.POLICY.FIELDS.FIELD_LIST_TITLE].deletable) {
        return;
    }

    const previousReportTitleField = policy?.fieldList?.[CONST.POLICY.FIELDS.FIELD_LIST_TITLE] ?? {};

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                fieldList: {
                    [CONST.POLICY.FIELDS.FIELD_LIST_TITLE]: {...previousReportTitleField, deletable: !enforced, pendingFields: {deletable: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE}},
                },
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                fieldList: {
                    [CONST.POLICY.FIELDS.FIELD_LIST_TITLE]: {pendingFields: {deletable: null}},
                },
                errorFields: null,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                fieldList: {
                    [CONST.POLICY.FIELDS.FIELD_LIST_TITLE]: {...previousReportTitleField, pendingFields: {deletable: null}},
                },
                errorFields: {
                    fieldList: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage'),
                },
            },
        },
    ];

    const parameters: SetPolicyPreventMemberCreatedTitleParams = {
        enforced,
        policyID,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_PREVENT_MEMBER_CREATED_TITLE, parameters, {
        optimisticData,
        successData,
        failureData,
    });
}

/**
 * Call the API to enable or disable self approvals for the reports
 * @param policyID - id of the policy to apply the naming pattern to
 * @param preventSelfApproval - flag whether to prevent workspace members from approving their own expense reports
 */
function setPolicyPreventSelfApproval(policyID: string, preventSelfApproval: boolean) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    if (preventSelfApproval === policy?.preventSelfApproval) {
        return;
    }

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                preventSelfApproval,
                pendingFields: {
                    preventSelfApproval: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                },
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                pendingFields: {
                    preventSelfApproval: null,
                },
                errorFields: null,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                preventSelfApproval: policy?.preventSelfApproval ?? false,
                pendingFields: {
                    preventSelfApproval: null,
                },
                errorFields: {
                    preventSelfApproval: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage'),
                },
            },
        },
    ];

    const parameters: SetPolicyPreventSelfApprovalParams = {
        preventSelfApproval,
        policyID,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_PREVENT_SELF_APPROVAL, parameters, {
        optimisticData,
        successData,
        failureData,
    });
}

/**
 * Call the API to apply automatic approval limit for the given policy
 * @param policyID - id of the policy to apply the limit to
 * @param limit - max amount for auto-approval of the reports in the given policy
 */
function setPolicyAutomaticApprovalLimit(policyID: string, limit: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    const fallbackLimit = limit === '' ? '0' : limit;
    const parsedLimit = CurrencyUtils.convertToBackendAmount(parseFloat(fallbackLimit));

    if (parsedLimit === (policy?.autoApproval?.limit ?? CONST.POLICY.AUTO_APPROVE_REPORTS_UNDER_DEFAULT_CENTS)) {
        return;
    }

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoApproval: {
                    limit: parsedLimit,
                    pendingFields: {limit: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE},
                },
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoApproval: {
                    pendingFields: {
                        limit: null,
                    },
                },
                errorFields: null,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoApproval: {
                    limit: policy?.autoApproval?.limit ?? CONST.POLICY.AUTO_APPROVE_REPORTS_UNDER_DEFAULT_CENTS,
                    pendingFields: {
                        limit: null,
                    },
                },
                errorFields: {
                    autoApproval: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage'),
                },
            },
        },
    ];

    const parameters: SetPolicyAutomaticApprovalLimitParams = {
        limit: parsedLimit,
        policyID,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_AUTOMATIC_APPROVAL_LIMIT, parameters, {
        optimisticData,
        successData,
        failureData,
    });
}

/**
 * Call the API to set the audit rate for the given policy
 * @param policyID - id of the policy to apply the limit to
 * @param auditRate - percentage of the reports to be qualified for a random audit
 */
function setPolicyAutomaticApprovalRate(policyID: string, auditRate: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const fallbackAuditRate = auditRate === '' ? '0' : auditRate;
    const parsedAuditRate = parseInt(fallbackAuditRate, 10) / 100;

    // The auditRate arrives as an int to this method so we will convert it to a float before sending it to the API.
    if (parsedAuditRate === (policy?.autoApproval?.auditRate ?? CONST.POLICY.RANDOM_AUDIT_DEFAULT_PERCENTAGE)) {
        return;
    }

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoApproval: {
                    auditRate: parsedAuditRate,
                    pendingFields: {
                        auditRate: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoApproval: {
                    pendingFields: {
                        auditRate: null,
                    },
                },
                errorFields: null,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoApproval: {
                    auditRate: policy?.autoApproval?.auditRate ?? CONST.POLICY.RANDOM_AUDIT_DEFAULT_PERCENTAGE,
                    pendingFields: {
                        auditRate: null,
                    },
                },
                errorFields: {
                    autoApproval: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage'),
                },
            },
        },
    ];

    const parameters: SetPolicyAutomaticApprovalRateParams = {
        auditRate: parsedAuditRate,
        policyID,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_AUTOMATIC_APPROVAL_RATE, parameters, {
        optimisticData,
        successData,
        failureData,
    });
}

/**
 * Call the API to enable auto-approval for the reports in the given policy
 * @param policyID - id of the policy to apply the limit to
 * @param enabled - whether auto-approve for the reports is enabled in the given policy
 */
function enableAutoApprovalOptions(policyID: string, enabled: boolean) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    if (enabled === policy?.shouldShowAutoApprovalOptions) {
        return;
    }

    const autoApprovalValues = {auditRate: CONST.POLICY.RANDOM_AUDIT_DEFAULT_PERCENTAGE, limit: CONST.POLICY.AUTO_APPROVE_REPORTS_UNDER_DEFAULT_CENTS};
    const autoApprovalFailureValues = {autoApproval: {limit: policy?.autoApproval?.limit, auditRate: policy?.autoApproval?.auditRate, pendingFields: null}};
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoApproval: {
                    ...autoApprovalValues,
                    pendingFields: {
                        limit: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                        auditRate: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
                shouldShowAutoApprovalOptions: enabled,
                pendingFields: {
                    shouldShowAutoApprovalOptions: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                },
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoApproval: {pendingFields: null},
                pendingFields: {
                    shouldShowAutoApprovalOptions: null,
                },
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                ...autoApprovalFailureValues,
                shouldShowAutoApprovalOptions: policy?.shouldShowAutoApprovalOptions,
                pendingFields: {
                    shouldShowAutoApprovalOptions: null,
                },
            },
        },
    ];

    const parameters: EnablePolicyAutoApprovalOptionsParams = {
        enabled,
        policyID,
    };

    API.write(WRITE_COMMANDS.ENABLE_POLICY_AUTO_APPROVAL_OPTIONS, parameters, {
        optimisticData,
        successData,
        failureData,
    });
}

/**
 * Call the API to set the limit for auto-payments in the given policy
 * @param policyID - id of the policy to apply the limit to
 * @param limit - max amount for auto-payment for the reports in the given policy
 */
function setPolicyAutoReimbursementLimit(policyID: string, limit: string) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);
    const fallbackLimit = limit === '' ? '0' : limit;
    const parsedLimit = CurrencyUtils.convertToBackendAmount(parseFloat(fallbackLimit));

    if (parsedLimit === (policy?.autoReimbursement?.limit ?? CONST.POLICY.AUTO_REIMBURSEMENT_DEFAULT_LIMIT_CENTS)) {
        return;
    }

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoReimbursement: {
                    limit: parsedLimit,
                    pendingFields: {
                        limit: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoReimbursement: {
                    limit: parsedLimit,
                    pendingFields: {
                        limit: null,
                    },
                },
                errorFields: null,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoReimbursement: {limit: policy?.autoReimbursement?.limit ?? policy?.autoReimbursementLimit, pendingFields: {limit: null}},
                errorFields: {
                    autoReimbursement: ErrorUtils.getMicroSecondOnyxErrorWithTranslationKey('common.genericErrorMessage'),
                },
            },
        },
    ];

    const parameters: SetPolicyAutoReimbursementLimitParams = {
        limit: parsedLimit,
        policyID,
    };

    API.write(WRITE_COMMANDS.SET_POLICY_AUTO_REIMBURSEMENT_LIMIT, parameters, {
        optimisticData,
        successData,
        failureData,
    });
}

/**
 * Call the API to enable auto-payment for the reports in the given policy
 *
 * @param policyID - id of the policy to apply the limit to
 * @param enabled - whether auto-payment for the reports is enabled in the given policy
 */
function enablePolicyAutoReimbursementLimit(policyID: string, enabled: boolean) {
    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    if (enabled === policy?.shouldShowAutoReimbursementLimitOption) {
        return;
    }

    const autoReimbursementFailureValues = {autoReimbursement: {limit: policy?.autoReimbursement?.limit, pendingFields: null}};
    const autoReimbursementValues = {limit: CONST.POLICY.AUTO_REIMBURSEMENT_DEFAULT_LIMIT_CENTS};
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoReimbursement: {
                    ...autoReimbursementValues,
                    pendingFields: {
                        limit: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
                shouldShowAutoReimbursementLimitOption: enabled,
                pendingFields: {
                    shouldShowAutoReimbursementLimitOption: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                },
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                autoReimbursement: {pendingFields: null},
                pendingFields: {
                    shouldShowAutoReimbursementLimitOption: null,
                },
                errorFields: null,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                ...autoReimbursementFailureValues,
                shouldShowAutoReimbursementLimitOption: policy?.shouldShowAutoReimbursementLimitOption,
                pendingFields: {
                    shouldShowAutoReimbursementLimitOption: null,
                },
            },
        },
    ];

    const parameters: EnablePolicyAutoReimbursementLimitParams = {
        enabled,
        policyID,
    };

    API.write(WRITE_COMMANDS.ENABLE_POLICY_AUTO_REIMBURSEMENT_LIMIT, parameters, {
        optimisticData,
        successData,
        failureData,
    });
}

function clearAllPolicies() {
    if (!allPolicies) {
        return;
    }
    Object.keys(allPolicies).forEach((key) => delete allPolicies[key]);
}

function updateInvoiceCompanyName(policyID: string, companyName: string) {
    const authToken = NetworkStore.getAuthToken();

    if (!authToken) {
        return;
    }

    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                invoice: {
                    companyName,
                    pendingFields: {
                        companyName: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                invoice: {
                    pendingFields: {
                        companyName: null,
                    },
                },
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                invoice: {
                    companyName: policy?.invoice?.companyName,
                    pendingFields: {
                        companyName: null,
                    },
                },
            },
        },
    ];

    const parameters: UpdateInvoiceCompanyNameParams = {
        authToken,
        policyID,
        companyName,
    };

    API.write(WRITE_COMMANDS.UPDATE_INVOICE_COMPANY_NAME, parameters, {optimisticData, successData, failureData});
}

function updateInvoiceCompanyWebsite(policyID: string, companyWebsite: string) {
    const authToken = NetworkStore.getAuthToken();

    if (!authToken) {
        return;
    }

    // This will be fixed as part of https://github.com/Expensify/Expensify/issues/507850
    // eslint-disable-next-line deprecation/deprecation
    const policy = getPolicy(policyID);

    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                invoice: {
                    companyWebsite,
                    pendingFields: {
                        companyWebsite: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    },
                },
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                invoice: {
                    pendingFields: {
                        companyWebsite: null,
                    },
                },
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
            value: {
                invoice: {
                    companyWebsite: policy?.invoice?.companyWebsite,
                    pendingFields: {
                        companyWebsite: null,
                    },
                },
            },
        },
    ];

    const parameters: UpdateInvoiceCompanyWebsiteParams = {
        authToken,
        policyID,
        companyWebsite,
    };

    API.write(WRITE_COMMANDS.UPDATE_INVOICE_COMPANY_WEBSITE, parameters, {optimisticData, successData, failureData});
}

/**
 * Validates user account and returns a list of accessible policies.
 */
function getAccessiblePolicies(validateCode?: string) {
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.VALIDATE_USER_AND_GET_ACCESSIBLE_POLICIES,
            value: {
                loading: true,
                errors: null,
            },
        },
    ];

    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.VALIDATE_USER_AND_GET_ACCESSIBLE_POLICIES,
            value: {
                loading: false,
                errors: null,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.VALIDATE_USER_AND_GET_ACCESSIBLE_POLICIES,
            value: {
                loading: false,
            },
        },
    ];

    const command = validateCode ? WRITE_COMMANDS.VALIDATE_USER_AND_GET_ACCESSIBLE_POLICIES : WRITE_COMMANDS.GET_ACCESSIBLE_POLICIES;

    API.write(command, validateCode ? {validateCode} : null, {optimisticData, successData, failureData});
}

/**
 * Clear the errors from the get accessible policies request
 */
function clearGetAccessiblePoliciesErrors() {
    Onyx.merge(ONYXKEYS.VALIDATE_USER_AND_GET_ACCESSIBLE_POLICIES, {errors: null});
}

/**
 * Call the API to calculate the bill for the new dot
 */
function calculateBillNewDot() {
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.IS_LOADING_BILL_WHEN_DOWNGRADE,
            value: true,
        },
    ];
    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.IS_LOADING_BILL_WHEN_DOWNGRADE,
            value: false,
        },
    ];
    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.IS_LOADING_BILL_WHEN_DOWNGRADE,
            value: false,
        },
    ];
    API.read(READ_COMMANDS.CALCULATE_BILL_NEW_DOT, null, {
        optimisticData,
        successData,
        failureData,
    });
}

/**
 * Call the API to pay and downgrade
 */
function payAndDowngrade() {
    const optimisticData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.BILLING_RECEIPT_DETAILS,
            value: {
                errors: null,
                isLoading: true,
            },
        },
    ];
    const successData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.BILLING_RECEIPT_DETAILS,
            value: {
                isLoading: false,
            },
        },
    ];

    const failureData: OnyxUpdate[] = [
        {
            onyxMethod: Onyx.METHOD.MERGE,
            key: ONYXKEYS.BILLING_RECEIPT_DETAILS,
            value: {
                isLoading: false,
            },
        },
    ];
    API.write(WRITE_COMMANDS.PAY_AND_DOWNGRADE, null, {optimisticData, successData, failureData});
}

function clearBillingReceiptDetailsErrors() {
    Onyx.merge(ONYXKEYS.BILLING_RECEIPT_DETAILS, {errors: null});
}

function setIsForcedToChangeCurrency(value: boolean) {
    Onyx.set(ONYXKEYS.IS_FORCED_TO_CHANGE_CURRENCY, value);
}

function setIsComingFromGlobalReimbursementsFlow(value: boolean) {
    Onyx.set(ONYXKEYS.IS_COMING_FROM_GLOBAL_REIMBURSEMENTS_FLOW, value);
}

function updateFeature(
    request: {
        endpoint: EnablePolicyFeatureCommand | typeof WRITE_COMMANDS.TOGGLE_POLICY_PER_DIEM;
        parameters: ApiRequestCommandParameters[EnablePolicyFeatureCommand | typeof WRITE_COMMANDS.TOGGLE_POLICY_PER_DIEM];
    },
    policyID: string,
) {
    if (request.endpoint === WRITE_COMMANDS.TOGGLE_POLICY_PER_DIEM) {
        API.write(WRITE_COMMANDS.TOGGLE_POLICY_PER_DIEM, {
            policyID,
            enabled: request.parameters.enabled,
            customUnitID: generateCustomUnitID(),
        });
        return;
    }
    // eslint-disable-next-line rulesdir/no-multiple-api-calls
    API.writeWithNoDuplicatesEnableFeatureConflicts(request.endpoint, request.parameters);
}

function updateInterestedFeatures(features: Feature[], policyID: string) {
    let shouldUpgradeToCorporate = false;

    const requests: Array<{
        endpoint: EnablePolicyFeatureCommand | typeof WRITE_COMMANDS.TOGGLE_POLICY_PER_DIEM;
        parameters: ApiRequestCommandParameters[EnablePolicyFeatureCommand | typeof WRITE_COMMANDS.TOGGLE_POLICY_PER_DIEM];
    }> = [];

    features.forEach((feature) => {
        // If the feature is not enabled by default and it's programmatically enabled, we need to enable it
        if (!feature.enabledByDefault && feature.programmaticallyEnabled) {
            if (feature.requiresUpdate && !shouldUpgradeToCorporate) {
                shouldUpgradeToCorporate = true;
            }
            requests.push({
                endpoint: feature.apiEndpoint,
                parameters: {
                    policyID,
                    enabled: true,
                },
            });
        }
        // If the feature is enabled by default and it's programmatically disabled, we need to disable it
        if (feature.enabledByDefault && !feature.programmaticallyEnabled) {
            requests.push({
                endpoint: feature.apiEndpoint,
                parameters: {
                    policyID,
                    enabled: false,
                },
            });
        }
    });

    if (shouldUpgradeToCorporate) {
        API.write(WRITE_COMMANDS.UPGRADE_TO_CORPORATE, {policyID});
    }

    requests.forEach((request) => {
        updateFeature(request, policyID);
    });
}

function clearPolicyTitleFieldError(policyID: string) {
    if (!policyID) {
        return;
    }
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {
        errorFields: {
            fieldList: {
                [CONST.POLICY.FIELDS.FIELD_LIST_TITLE]: null,
            },
        },
    });
}

export {
    leaveWorkspace,
    addBillingCardAndRequestPolicyOwnerChange,
    hasActiveChatEnabledPolicies,
    setWorkspaceErrors,
    hideWorkspaceAlertMessage,
    deleteWorkspace,
    updateAddress,
    updateLastAccessedWorkspace,
    clearDeleteWorkspaceError,
    setWorkspaceDefaultSpendCategory,
    generateDefaultWorkspaceName,
    updateGeneralSettings,
    deleteWorkspaceAvatar,
    updateWorkspaceAvatar,
    clearAvatarErrors,
    generatePolicyID,
    createWorkspace,
    openPolicyTaxesPage,
    openWorkspaceInvitePage,
    openWorkspace,
    removeWorkspace,
    createWorkspaceFromIOUPayment,
    clearErrors,
    dismissAddedWithPrimaryLoginMessages,
    openDraftWorkspaceRequest,
    createDraftInitialWorkspace,
    buildOptimisticRecentlyUsedCurrencies,
    setWorkspaceInviteMessageDraft,
    setWorkspaceApprovalMode,
    setWorkspaceAutoReportingFrequency,
    setWorkspaceAutoReportingMonthlyOffset,
    updateWorkspaceDescription,
    setWorkspacePayer,
    setWorkspaceReimbursement,
    openPolicyWorkflowsPage,
    enableCompanyCards,
    enablePolicyConnections,
    enablePolicyReportFields,
    enablePolicyTaxes,
    enablePolicyWorkflows,
    enableDistanceRequestTax,
    enablePolicyInvoicing,
    openPolicyMoreFeaturesPage,
    openPolicyProfilePage,
    openPolicyInitialPage,
    generateCustomUnitID,
    clearQBOErrorField,
    clearXeroErrorField,
    clearSageIntacctErrorField,
    clearNetSuiteErrorField,
    clearNetSuitePendingField,
    clearNetSuiteAutoSyncErrorField,
    removeNetSuiteCustomFieldByIndex,
    setWorkspaceCurrencyDefault,
    setForeignCurrencyDefault,
    setPolicyCustomTaxName,
    clearPolicyErrorField,
    isCurrencySupportedForDirectReimbursement,
    isCurrencySupportedForGlobalReimbursement,
    getInvoicePrimaryWorkspace,
    createDraftWorkspace,
    savePreferredExportMethod,
    buildPolicyData,
    enableExpensifyCard,
    createPolicyExpenseChats,
    upgradeToCorporate,
    openPolicyExpensifyCardsPage,
    updateMemberCustomField,
    openPolicyEditCardLimitTypePage,
    requestExpensifyCardLimitIncrease,
    getAdminPolicies,
    getAdminPoliciesConnectedToNetSuite,
    getAdminPoliciesConnectedToSageIntacct,
    hasInvoicingDetails,
    clearAllPolicies,
    enablePolicyRules,
    setPolicyDefaultReportTitle,
    clearQBDErrorField,
    setPolicyPreventMemberCreatedTitle,
    setPolicyPreventSelfApproval,
    setPolicyAutomaticApprovalLimit,
    setPolicyAutomaticApprovalRate,
    setPolicyAutoReimbursementLimit,
    enablePolicyAutoReimbursementLimit,
    enableAutoApprovalOptions,
    setPolicyMaxExpenseAmountNoReceipt,
    setPolicyMaxExpenseAmount,
    setPolicyMaxExpenseAge,
    updateCustomRules,
    setPolicyProhibitedExpense,
    setPolicyBillableMode,
    disableWorkspaceBillableExpenses,
    setWorkspaceEReceiptsEnabled,
    verifySetupIntentAndRequestPolicyOwnerChange,
    updateInvoiceCompanyName,
    updateInvoiceCompanyWebsite,
    updateDefaultPolicy,
    downgradeToTeam,
    getAccessiblePolicies,
    clearGetAccessiblePoliciesErrors,
    calculateBillNewDot,
    payAndDowngrade,
    clearBillingReceiptDetailsErrors,
    clearQuickbooksOnlineAutoSyncErrorField,
    setIsForcedToChangeCurrency,
    setIsComingFromGlobalReimbursementsFlow,
    setPolicyAttendeeTrackingEnabled,
    updateInterestedFeatures,
    clearPolicyTitleFieldError,
};
