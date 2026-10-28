// "Solicitar garantía": ver functions-lib/warranty.js
import { handle } from '../../../functions-lib/warranty.js';
export const onRequestPost = (context) => handle(context, 'claim');
