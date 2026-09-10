import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'i18next-react';

import commonDe from '../../public/locales/de/common.json';
import commonEn from '../../public/locales/en/common.json';
import commonEs from '../../public/locales/es/common.json';
import commonFr from '../../public/locales/fr/common.json';
import commonIt from '../../public/locales/it/common.json';
import commonPt from '../../public/locales/pt/common.json';
import commonNl from '../../public/locales/nl/common.json';
import commonPl from '../../public/locales/pl/common.json';
import commonRu from '../../public/locales/ru/common.json';
import commonSv from '../../public/locales/sv/common.json';

import navigationDe from '../../public/locales/de/navigation.json';
import navigationEn from '../../public/locales/en/navigation.json';
import navigationEs from '../../public/locales/es/navigation.json';
import navigationFr from '../../public/locales/fr/navigation.json';
import navigationIt from '../../public/locales/it/navigation.json';
import navigationPt from '../../public/locales/pt/navigation.json';
import navigationNl from '../../public/locales/nl/navigation.json';
import navigationPl from '../../public/locales/pl/navigation.json';
import navigationRu from '../../public/locales/ru/navigation.json';
import navigationSv from '../../public/locales/sv/navigation.json';

import formsDe from '../../public/locales/de/forms.json';
import formsEn from '../../public/locales/en/forms.json';
import formsEs from '../../public/locales/es/forms.json';
import formsFr from '../../public/locales/fr/forms.json';
import formsIt from '../../public/locales/it/forms.json';
import formsPt from '../../public/locales/pt/forms.json';
import formsNl from '../../public/locales/nl/forms.json';
import formsPl from '../../public/locales/pl/forms.json';
import formsRu from '../../public/locales/ru/forms.json';
import formsSv from '../../public/locales/sv/forms.json';

import messagesDe from '../../public/locales/de/messages.json';
import messagesEn from '../../public/locales/en/messages.json';
import messagesEs from '../../public/locales/es/messages.json';
import messagesFr from '../../public/locales/fr/messages.json';
import messagesIt from '../../public/locales/it/messages.json';
import messagesPt from '../../public/locales/pt/messages.json';
import messagesNl from '../../public/locales/nl/messages.json';
import messagesPl from '../../public/locales/pl/messages.json';
import messagesRu from '../../public/locales/ru/messages.json';
import messagesSv from '../../public/locales/sv/messages.json';

const resources = {
  de: { common: commonDe, navigation: navigationDe, forms: formsDe, messages: messagesDe },
  en: { common: commonEn, navigation: navigationEn, forms: formsEn, messages: messagesEn },
  es: { common: commonEs, navigation: navigationEs, forms: formsEs, messages: messagesEs },
  fr: { common: commonFr, navigation: navigationFr, forms: formsFr, messages: messagesFr },
  it: { common: commonIt, navigation: navigationIt, forms: formsIt, messages: messagesIt },
  pt: { common: commonPt, navigation: navigationPt, forms: formsPt, messages: messagesPt },
  nl: { common: commonNl, navigation: navigationNl, forms: formsNl, messages: messagesNl },
  pl: { common: commonPl, navigation: navigationPl, forms: formsPl, messages: messagesPl },
  ru: { common: commonRu, navigation: navigationRu, forms: formsRu, messages: messagesRu },
  sv: { common: commonSv, navigation: navigationSv, forms: formsSv, messages: messagesSv },
};

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'de',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18next;
