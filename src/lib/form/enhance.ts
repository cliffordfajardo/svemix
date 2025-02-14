import { invalidate } from '$app/navigation';
import type { EnhanceFormError, EnhanceFormPending, EnhanceFormValidate } from './types';

export type InternalEnhanceFormResult = ({
	data,
	redirectTo,
	refreshSession,
	formData,
	form,
	response
}: {
	data: Record<string, any>;
	formData: FormData;
	response: Response;
	form: HTMLFormElement;
	redirectTo: string;
	refreshSession: boolean;
}) => void | Promise<void>;

// this action (https://svelte.dev/tutorial/actions) allows us to
// progressively enhance a <form> that already works without JS
export function enhance(
	form: HTMLFormElement,
	{
		validate,
		pending,
		formError,
		result
	}: {
		validate?: EnhanceFormValidate;
		pending?: EnhanceFormPending;
		formError?: EnhanceFormError;
		result?: InternalEnhanceFormResult;
	} = {}
): { destroy: () => void } {
	let current_token: unknown;

	async function handle_submit(e: Event) {
		const token = (current_token = {});

		e.preventDefault();

		const data = new FormData(form);

		if (validate) {
			const validation_result = validate(data);
			if (Object.values(validation_result).some((err) => err.length > 0)) {
				return;
			}
		}

		if (pending) pending({ data, form });

		try {
			const response = await fetch(form.action, {
				credentials: 'include',
				method: form.method,
				headers: {
					accept: 'application/json'
				},
				body: data
			});

			if (token !== current_token) return;

			if (response.ok) {
				const redirectTo = response.headers.get('x-svemix-location') || '';

				if (redirectTo.length > 0) {
					await result({
						formData: data,
						form,
						data: undefined,
						response: response,
						refreshSession: false,
						redirectTo
					});
					return;
				}

				const json = await response.json();
				const actionData = json?.actionData;

				const refreshSessionHeader = response.headers.get('x-svemix-refresh-session') || 'false';
				const refreshSession = refreshSessionHeader === 'true';

				if (result) {
					await result({
						formData: data,
						form,
						data: actionData,
						response: response,
						refreshSession,
						redirectTo
					});
				}

				const url = new URL(form.action);
				url.search = url.hash = '';

				let shouldInvalidate = true;

				if (redirectTo.length > 0) {
					shouldInvalidate = false;
				}

				if (actionData && actionData.errors) {
					if (Object.values<string>(actionData.errors).some((err) => err.length > 0)) {
						shouldInvalidate = false;
					}
				}

				// TODO: Is this behaviour right? If i uncomment this, SvelteKit invalidates 2 times which seems like to much...
				if (refreshSession) {
					shouldInvalidate = false;
				}

				if (shouldInvalidate) {
					invalidate(url.href);
				}
			} else if (formError) {
				formError({ formData: data, form, error: null, response });
			} else {
				console.error(await response.text());
			}
		} catch (e: any) {
			console.log(e);

			if (formError) {
				formError({ formData: data, form, error: e, response: null });
			} else {
				throw e;
			}
		}
	}

	form.addEventListener('submit', handle_submit);

	return {
		destroy() {
			form.removeEventListener('submit', handle_submit);
		}
	};
}
