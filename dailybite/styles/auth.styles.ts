import { StyleSheet } from 'react-native'

export const authStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8F5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  signedInContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  eyebrow: {
    color: '#277C65',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: 12,
  },
  title: {
    color: '#172329',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 0,
  },
  body: {
    color: '#526168',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  form: {
    marginTop: 36,
  },
  label: {
    color: '#28363C',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C7D0CC',
    borderRadius: 6,
    borderWidth: 1,
    color: '#172329',
    fontSize: 16,
    height: 50,
    marginBottom: 20,
    paddingHorizontal: 14,
  },
  message: {
    color: '#A63D2C',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#277C65',
    borderRadius: 6,
    height: 50,
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#80A999',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#277C65',
    borderRadius: 6,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    marginTop: 32,
  },
  secondaryButtonText: {
    color: '#277C65',
    fontSize: 16,
    fontWeight: '700',
  },
  modeButton: {
    alignSelf: 'center',
    marginTop: 28,
    padding: 8,
  },
  modeButtonText: {
    color: '#277C65',
    fontSize: 15,
    fontWeight: '600',
  },
})
