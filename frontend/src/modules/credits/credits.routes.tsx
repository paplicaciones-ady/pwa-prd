import type { FrontendModule } from '../registry/types';
import { CreditsHomePage } from './CreditsHomePage';
import { CreditsListPage } from './CreditsListPage';
import { CreditStudyPage } from './CreditStudyPage';
import { CreditResultPage } from './CreditResultPage';
import { CreditSignPage } from './CreditSignPage';
import { CreditSuccessPage } from './CreditSuccessPage';
import { CreditPortfolioPage } from './CreditPortfolioPage';
import { CreditDocumentsPage } from './CreditDocumentsPage';

export const creditsModule: FrontendModule = {
  module: 'credits',
  label: 'Créditos',
  basePath: '/credits',
  routes: [
    { path: '/credits', perm: 'credits.read', element: <CreditsHomePage /> },
    { path: '/credits/list', perm: 'credits.read', element: <CreditsListPage /> },
    { path: '/credits/study', perm: 'credits.study', element: <CreditStudyPage /> },
    { path: '/credits/result/:id', perm: 'credits.study', element: <CreditResultPage /> },
    { path: '/credits/sign/:id', perm: 'credits.study', element: <CreditSignPage /> },
    { path: '/credits/success/:id', perm: 'credits.study', element: <CreditSuccessPage /> },
    { path: '/credits/mine', perm: 'credits.read', element: <CreditPortfolioPage /> },
    { path: '/credits/:id/documents', perm: 'credits.read', element: <CreditDocumentsPage /> },
  ],
};
