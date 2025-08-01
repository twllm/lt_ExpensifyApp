import React, {useEffect} from 'react';
import DelegateNoAccessWrapper from '@components/DelegateNoAccessWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useSubStep from '@hooks/useSubStep';
import type {SubStepProps} from '@hooks/useSubStep/types';
import {clearDraftValues} from '@libs/actions/FormActions';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {SettingsNavigatorParamList} from '@navigation/types';
import {updateSubscriptionSize} from '@userActions/Subscription';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import INPUT_IDS from '@src/types/form/SubscriptionSizeForm';
import Confirmation from './substeps/Confirmation';
import Size from './substeps/Size';

const bodyContent: Array<React.ComponentType<SubStepProps>> = [Size, Confirmation];

type SubscriptionSizePageProps = PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.SETTINGS.SUBSCRIPTION.SIZE>;

function SubscriptionSizePage({route}: SubscriptionSizePageProps) {
    const [privateSubscription] = useOnyx(ONYXKEYS.NVP_PRIVATE_SUBSCRIPTION, {canBeMissing: false});
    const [subscriptionSizeFormDraft] = useOnyx(ONYXKEYS.FORMS.SUBSCRIPTION_SIZE_FORM_DRAFT, {canBeMissing: false});
    const {translate} = useLocalize();
    const canChangeSubscriptionSize = !!(route.params?.canChangeSize ?? 1);
    const startFrom = canChangeSubscriptionSize ? 0 : 1;

    const onFinished = () => {
        updateSubscriptionSize(subscriptionSizeFormDraft ? Number(subscriptionSizeFormDraft[INPUT_IDS.SUBSCRIPTION_SIZE]) : 0, privateSubscription?.userCount ?? 0);
        Navigation.goBack();
    };

    const {componentToRender: SubStep, screenIndex, nextScreen, prevScreen, moveTo} = useSubStep({bodyContent, startFrom, onFinished});

    const onBackButtonPress = () => {
        if (screenIndex !== 0 && startFrom === 0) {
            prevScreen();
            return;
        }

        Navigation.goBack();
    };

    useEffect(
        () => () => {
            clearDraftValues(ONYXKEYS.FORMS.SUBSCRIPTION_SIZE_FORM);
        },
        [],
    );

    return (
        <ScreenWrapper
            testID={SubscriptionSizePage.displayName}
            includeSafeAreaPaddingBottom={false}
            shouldEnablePickerAvoiding={false}
            shouldEnableMaxHeight
            shouldShowOfflineIndicatorInWideScreen
        >
            <DelegateNoAccessWrapper accessDeniedVariants={[CONST.DELEGATE.DENIED_ACCESS_VARIANTS.DELEGATE]}>
                <HeaderWithBackButton
                    title={translate('subscription.subscriptionSize.title')}
                    onBackButtonPress={onBackButtonPress}
                />
                <SubStep
                    isEditing={canChangeSubscriptionSize}
                    onNext={nextScreen}
                    onMove={moveTo}
                />
            </DelegateNoAccessWrapper>
        </ScreenWrapper>
    );
}

SubscriptionSizePage.displayName = 'SubscriptionSizePage';

export default SubscriptionSizePage;
