// "Registra tu 715": ver functions-lib/warranty.js
import { handle } from '../../../functions-lib/warranty.js';
export const onRequestPost = (context) => handle(context, 'register');
